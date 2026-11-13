import { randomUUID } from 'node:crypto';
import { release } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { TELEMETRY_VERSION, type DailyReport, type TelemetrySnapshot } from '@argus/shared/telemetry';
import { loadAppSettings, saveAppSettings } from '../appSettings';
import { lang } from '../i18n';
import { errorMessage } from '../lib/errors';
import { readJsonFile, writeJsonAtomic, writeJsonAtomicSync } from '../lib/jsonFile';
import { IS_LINUX, IS_MAC, IS_WIN } from '../platform';
import { SMOKE_TEST } from '../smokeTest';
import { addUsage, bump, emptyDay, localDay, toolName, usageDelta, type DayStats, type Totals } from './day';

// Dados de uso anônimos (Configurações > Geral). Cada instalação junta números do dia (tempo de uso,
// conversas, tokens por modelo, quanto tem no canvas) e manda o resumo ao Worker apps/telemetry, que
// guarda um por instalação e dia (mandar de novo o mesmo dia substitui). Nada de conteúdo: ver
// packages/shared/src/telemetry.ts.
//
// Vem ligado (também para quem atualiza) e desliga em Configurações > Geral; desligado, o que estava
// juntado é apagado e nada sai. Só no app instalado: no pnpm dev, só com ARGUS_TELEMETRY_URL (a
// Worker rodando local, `cd telemetry && wrangler dev`).

const DEFAULT_URL = 'https://telemetry.argusterm.com/v1/report';
const endpoint = () => process.env.ARGUS_TELEMETRY_URL || (app.isPackaged ? DEFAULT_URL : '');

// O relógio do tempo de uso: a cada minuto conta o tempo desde a última volta, se a janela estava em
// foco ou havia conversa rodando. Intervalo maior que isso (computador dormindo, App Nap) conta até
// MAX_GAP_MS: o computador dormindo não é uso.
const TICK_MS = 60_000;
const MAX_GAP_MS = 2 * 60_000;
// De quanto em quanto tempo o dia de hoje vai de novo (o resumo do dia substitui o anterior).
const SEND_EVERY_MS = 30 * 60_000;
// Dias que esperam envio sem internet; mais velhos que isso saem.
const KEEP_DAYS = 14;
// Conversas cujo total de tokens fica guardado (para contar só o que é novo ao retomar uma delas).
const KEEP_SESSIONS = 300;

type Stored = {
  days: Record<string, DayStats>
  // Último total de tokens visto por conversa (ver usageDelta).
  sessions: Record<string, { at: number; totals: Totals }>
};

export type TelemetrySources = {
  // Alguma conversa trabalhando agora.
  busy: () => boolean
  snapshot: () => TelemetrySnapshot
  claudeCode: () => string | null
  wsl: () => boolean
};

const file = () => join(app.getPath('userData'), 'telemetry.json');

const SYSTEM: DailyReport['app']['os'] = IS_WIN ? 'windows' : IS_LINUX ? 'linux' : 'macos';

// Versão do sistema sem detalhe: "26" no Mac, "11" ou "10" no Windows (build 22000 em diante é o
// 11), "6.8" (núcleo) no Linux.
function osVersion(): string {
  try {
    const v = IS_LINUX ? release() : process.getSystemVersion();
    if (IS_WIN) return Number(v.split('.')[2]) >= 22000 ? '11' : '10';
    if (IS_MAC) return v.split('.')[0];
    return v.split('.').slice(0, 2).join('.');
  } catch {
    return 'unknown';
  }
}

export const enabled = (): boolean => loadAppSettings().usageStats !== false;

class Telemetry {
  private state: Stored = { days: {}, sessions: {} };
  private sources: TelemetrySources | null = null;
  private timer: NodeJS.Timeout | null = null;
  private lastTick = Date.now();
  private lastSend = 0;
  private sending = false;
  private dirty = false;

  // Junta só com o serviço ligado: nos testes e no dev sem endereço, as chamadas não fazem nada.
  private get on(): boolean {
    return !!this.sources;
  }

  start(sources: TelemetrySources): void {
    if (SMOKE_TEST || !endpoint() || !enabled()) return;
    this.sources = sources;
    const r = readJsonFile<Stored>(file());
    if (r.status === 'ok' && r.data?.days && r.data.sessions) this.state = r.data;
    this.today().counts.appOpens++;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
    // Os dias que ficaram sem envio saem logo; o de hoje, na próxima volta de SEND_EVERY_MS.
    setTimeout(() => void this.send(), 15_000).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.on) return;
    this.tick();
    this.persistNow();
  }

  // Switch das Configurações. Desligado: apaga o que estava juntado e para.
  setEnabled(next: boolean, sources: TelemetrySources): void {
    saveAppSettings({ usageStats: next });
    if (next) {
      if (!this.on) this.start(sources);
      return;
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.sources = null;
    this.state = { days: {}, sessions: {} };
    try {
      writeJsonAtomicSync(file(), this.state);
    } catch {
      // Sem gravar, o arquivo velho fica, mas nada mais é mandado com o switch desligado.
    }
  }

  // --- O que acontece no app ---

  chatCreated(agent: string): void {
    if (this.on) bump(this.today().counts.chatsCreated, agent);
  }

  messageSent(agent: string): void {
    if (this.on) bump(this.today().counts.messagesSent, agent);
  }

  workspaceCreated(): void {
    if (this.on) this.today().counts.workspacesCreated++;
  }

  worktreeCreated(): void {
    if (this.on) this.today().counts.worktreesCreated++;
  }

  toolUsed(name: string): void {
    if (this.on) bump(this.today().tools, toolName(name));
  }

  // Fim de um pedido do Claude: os totais acumulados da sessão. resumed: a conversa já existia; sem
  // total guardado dela, o acumulado traz pedidos antigos, e vale só o deste pedido (turn).
  claudeResult(sessionId: string, totals: Totals, resumed: boolean, turn: Totals[string] | null): void {
    if (!this.on || !sessionId) return;
    const before = this.state.sessions[sessionId]?.totals;
    let delta: Totals;
    if (!before && resumed) {
      const main = Object.entries(totals).sort((a, b) => b[1].output - a[1].output)[0]?.[0];
      delta = main && turn ? { [main]: { ...turn, costUsd: 0 } } : {};
    } else delta = usageDelta(before, totals);
    this.remember(sessionId, totals);
    const day = this.today();
    for (const [model, d] of Object.entries(delta)) addUsage(day, `claude:${model}`, d);
    this.dirty = true;
  }

  // Codex: total acumulado da conversa (thread/tokenUsage/updated), mesmo esquema do Claude. O total
  // é da conversa, não do modelo: a diferença vai para o modelo em uso agora (trocar de modelo no
  // meio não conta o histórico de novo).
  codexUsage(threadId: string, model: string, total: Totals[string]): void {
    if (!this.on || !threadId) return;
    const key = `codex:${threadId}`;
    const before = this.state.sessions[key]?.totals;
    const delta = usageDelta(before, { all: total }).all;
    this.remember(key, { all: total });
    // Primeira leitura de uma conversa retomada: o total traz o histórico, que já foi contado (ou é
    // de antes dos dados de uso). Vale a partir da próxima.
    if (!delta || (!before && this.resumedCodex.has(threadId))) return;
    // O pedido em si conta em agentTurn (uma leitura de tokens vem a cada resposta do modelo).
    addUsage(this.today(), `codex:${model}`, delta, 0);
  }

  // Conversas do Codex abertas retomando uma existente (ver codexUsage).
  readonly resumedCodex = new Set<string>();

  // Pedido de um agente que não é o Claude: conta o pedido no modelo (os tokens do Codex vêm em
  // codexUsage; o Gemini e o Cursor não informam).
  agentTurn(agent: string, model: string): void {
    if (this.on) addUsage(this.today(), `${agent}:${model || 'default'}`, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 });
  }

  // --- Por dentro ---

  private today(): DayStats {
    this.dirty = true;
    return (this.state.days[localDay(new Date())] ??= emptyDay());
  }

  private remember(id: string, totals: Totals): void {
    this.state.sessions[id] = { at: Date.now(), totals };
    const ids = Object.keys(this.state.sessions);
    if (ids.length <= KEEP_SESSIONS) return;
    ids.sort((a, b) => this.state.sessions[a].at - this.state.sessions[b].at);
    for (const old of ids.slice(0, ids.length - KEEP_SESSIONS)) delete this.state.sessions[old];
  }

  private tick(): void {
    const sources = this.sources;
    if (!sources) return;
    const now = Date.now();
    const minutes = Math.min(now - this.lastTick, MAX_GAP_MS) / 60_000;
    this.lastTick = now;
    let focused = false;
    let busy = false;
    try {
      focused = BrowserWindow.getFocusedWindow() !== null;
      busy = sources.busy();
    } catch {
      // Janelas fechando: a volta não conta.
    }
    if (focused || busy) {
      const t = this.today().time;
      t.activeMinutes += minutes;
      if (focused) t.focusedMinutes += minutes;
      if (busy) t.runningMinutes += minutes;
    }
    this.persist();
    if (now - this.lastSend >= SEND_EVERY_MS) void this.send();
  }

  private persist(): void {
    if (!this.dirty) return;
    this.dirty = false;
    void writeJsonAtomic(file(), this.state).catch(() => {});
  }

  private persistNow(): void {
    try {
      writeJsonAtomicSync(file(), this.state);
    } catch {
      // Sem gravar, perde o que juntou desde a última volta.
    }
  }

  private appInfo(sources: TelemetrySources): DailyReport['app'] {
    return {
      version: app.getVersion(),
      os: SYSTEM,
      osVersion: osVersion(),
      arch: process.arch,
      language: lang(),
      wsl: IS_WIN && sources.wsl(),
      claudeCode: sources.claudeCode(),
    };
  }

  private report(day: string, stats: DayStats, installId: string): DailyReport {
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      v: TELEMETRY_VERSION,
      installId,
      day,
      app: stats.app!,
      time: {
        activeMinutes: round(stats.time.activeMinutes),
        focusedMinutes: round(stats.time.focusedMinutes),
        runningMinutes: round(stats.time.runningMinutes),
      },
      counts: stats.counts,
      models: Object.fromEntries(Object.entries(stats.models).map(([k, u]) => [k, { ...u, costUsd: Math.round(u.costUsd * 10000) / 10000 }])),
      tools: stats.tools,
      snapshot: stats.snapshot,
    };
  }

  private async send(): Promise<void> {
    const sources = this.sources;
    if (!sources || this.sending) return;
    this.sending = true;
    this.lastSend = Date.now();
    try {
      const settings = loadAppSettings();
      const installId = settings.installId ?? saveAppSettings({ installId: randomUUID() }).installId!;
      const today = localDay(new Date());
      // Hoje leva a foto do canvas e a versão de agora; os dias passados, as do último envio deles.
      const t = this.today();
      t.app = this.appInfo(sources);
      try {
        t.snapshot = sources.snapshot();
      } catch (err) {
        console.warn('[dados de uso] foto do canvas:', errorMessage(err));
      }
      const oldest = localDay(new Date(Date.now() - KEEP_DAYS * 86_400_000));
      for (const day of Object.keys(this.state.days).sort()) {
        const stats = this.state.days[day];
        if (day < oldest) {
          delete this.state.days[day];
          continue;
        }
        // Dia que virou antes do primeiro envio dele: vai com a versão de agora.
        stats.app ??= t.app;
        const ok = await post(this.report(day, stats, installId));
        if (!ok) break;
        // Dia que já acabou e foi aceito não volta; o de hoje segue juntando.
        if (day !== today && this.state.days[day] === stats) delete this.state.days[day];
      }
      this.dirty = true;
      this.persist();
    } finally {
      this.sending = false;
    }
  }
}

async function post(report: DailyReport): Promise<boolean> {
  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(15_000),
    });
    // Recusado pelo formato (400): mandar de novo não adianta; vale como entregue para não travar a fila.
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

export const telemetry = new Telemetry();
