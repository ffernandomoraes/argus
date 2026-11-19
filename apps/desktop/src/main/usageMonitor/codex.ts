import type { Usage } from '@argus/shared/usage';
import { createBackoff } from '../lib/backoff';
import { errorMessage } from '../lib/errors';
import { providerLaunch } from '../providers/env';
import type { JsonRpcProcess } from '../providers/rpc';
import { openCodex } from '../providers/status';
import { codexBuckets, codexUsage, mergeCodexSnapshot, type CodexBuckets, type CodexSnapshot } from './codexParse';
import { ProviderUsageMonitors, type AccountUsageMonitor, type AccountUsageUpdate } from './providerMonitors';
import type { SavedUsages } from './saved';

// Limites de cada conta do Codex. O app-server responde `account/rateLimits/read` sem gastar uso;
// ele abre só para a leitura e fecha em seguida (nada fica aberto entre uma e outra). Durante uma
// conversa, o próprio app-server dela avisa a cada pedido (ver CodexDriver): a barra muda na hora,
// e a leitura periódica só cobre o uso feito fora do app (terminal, extensão do VS Code).

const POLL_MS = 5 * 60_000;

// Aviso das conversas abertas (agentChats/codex.ts) para o monitor da conta, sem uma importar a outra.
let onLive: (accountId: string, snapshot: CodexSnapshot) => void = () => {};
export const reportCodexRateLimits = (accountId: string, snapshot: CodexSnapshot) => onLive(accountId, snapshot);

class CodexUsageMonitor implements AccountUsageMonitor {
  private timer: NodeJS.Timeout | null = null;
  private rpc: JsonRpcProcess | null = null;
  private reading = false;
  private stopped = false;
  // Muda a cada login trocado: a leitura que já estava no ar responde pela conta anterior.
  private gen = 0;
  // Leitura que falhou (sem internet, conta por chave de API, que não tem esse limite): espera cada
  // vez mais, até 1 hora, em vez de abrir o Codex a cada 5 minutos à toa.
  private backoff = createBackoff({ initialMs: POLL_MS, maxMs: 60 * 60_000 });
  private buckets: CodexBuckets = {};
  last: Usage | null = null;

  constructor(
    private accountId: string,
    private onUpdate: AccountUsageUpdate,
  ) {}

  start(): void {
    void this.read();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.rpc?.close();
    this.rpc = null;
  }

  // Login trocado: o que se sabia era da conta anterior, e sai da tela até a leitura do novo.
  reread(): void {
    this.gen++;
    this.buckets = {};
    if (this.last) {
      this.last = null;
      this.onUpdate(null, true);
    }
    this.backoff.reset();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Com uma leitura no ar, ela mesma chama a próxima ao terminar (ver read).
    void this.read();
  }

  live(snapshot: CodexSnapshot): void {
    this.buckets = mergeCodexSnapshot(this.buckets, snapshot);
    this.publish();
  }

  private async read(): Promise<void> {
    if (this.reading || this.stopped) return;
    const launch = providerLaunch('codex', ['app-server'], this.accountId);
    if (!launch) return;
    this.reading = true;
    const gen = this.gen;
    let ok = false;
    try {
      this.rpc = await openCodex(launch);
      if (this.stopped || gen !== this.gen) return;
      const res = await this.rpc.request<Parameters<typeof codexBuckets>[0]>(
        'account/rateLimits/read',
        // Leitura de fundo: sem a lista dos créditos de reinício, que o app não mostra.
        { excludeResetCreditDetails: true },
        30_000,
      );
      if (this.stopped || gen !== this.gen) return;
      this.buckets = codexBuckets(res);
      this.publish();
      ok = true;
    } catch (err) {
      console.warn('[usage] codex: limites não lidos:', errorMessage(err));
    } finally {
      this.rpc?.close();
      this.rpc = null;
      this.reading = false;
      if (ok) this.backoff.reset();
      const wait = gen !== this.gen ? 0 : ok ? POLL_MS : this.backoff.next();
      if (!this.stopped) this.timer = setTimeout(() => void this.read(), wait);
    }
  }

  private publish(): void {
    const usage = codexUsage(this.buckets, Date.now());
    const had = !!this.last;
    this.last = usage;
    this.onUpdate(usage, had);
  }
}

// Um monitor por conta do Codex logada (ver providerMonitors.ts).
export class CodexUsageMonitors extends ProviderUsageMonitors<CodexUsageMonitor> {
  constructor(onUpdate: (account: string, usage: Usage | null) => void, saved: SavedUsages) {
    super('codex', (id, update) => new CodexUsageMonitor(id, update), onUpdate, saved);
    onLive = (id, snapshot) => this.get(id)?.live(snapshot);
  }
}
