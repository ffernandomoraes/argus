import { basename } from 'node:path';
import type { ChatSettings } from '@argus/shared/chat';
import type { ProviderId } from '@argus/shared/providers';
import { tr } from '../i18n';
import { openAcpProcess } from '../providers/acpProcess';
import { providerLaunch } from '../providers/env';
import { folderArgs } from '../workspaceFolders';
import { trustGemini } from '../workspaces';
import { RpcError, type JsonRpcProcess } from '../providers/rpc';
import { fromTexts } from './diff';
import type { Driver, DriverEvents, PermissionReply, PromptInput, ToolEvent } from './driver';
import { telemetry } from '../telemetry';
import { reportAntigravityTurn } from '../usageMonitor/antigravity';

// Gemini (`gemini --acp`), Cursor (`agent acp`) e Antigravity (`agy acp`) pelo Agent Client
// Protocol, o protocolo aberto do Zed para editores falarem com agentes (agentclientprotocol.com).
// JSON-RPC na entrada e saída padrão: session/new (ou load), session/prompt e os avisos
// session/update. O app não oferece arquivos nem terminal ao agente: cada um usa os próprios
// (conferido com o Cursor 2026.10.14, o Gemini 0.63 e o agy 1.5.12).

type SelectOption = { value: string; name: string; description?: string };
export type ConfigOption = { id: string; name: string; category?: string; type: string; currentValue: string; options: SelectOption[] };
type SessionInfo = {
  sessionId: string
  modes?: { currentModeId: string; availableModes: { id: string; name: string }[] }
  models?: { currentModelId: string; availableModels: { modelId: string; name: string }[] }
  configOptions?: ConfigOption[]
};

type AcpTool = {
  toolCallId: string
  title?: string
  kind?: string
  status?: string
  rawInput?: Record<string, unknown>
  content?: { type: string; path?: string; oldText?: string | null; newText?: string; content?: { type: string; text?: string } }[]
  locations?: { path: string }[]
  // Fim de um comando: saída e código (o Cursor manda assim).
  rawOutput?: { exitCode?: number; stdout?: string; stderr?: string; output?: string }
};

const KIND_LABEL: Record<string, string> = {
  read: tr('Ler', 'Read'),
  edit: tr('Editar', 'Edit'),
  delete: tr('Apagar', 'Delete'),
  move: tr('Mover', 'Move'),
  search: tr('Buscar', 'Search'),
  execute: tr('Comando', 'Command'),
  think: tr('Pensar', 'Think'),
  fetch: tr('Buscar na web', 'Fetch'),
  switch_mode: tr('Trocar modo', 'Switch mode'),
};

const KIND_NAME: Record<string, string> = { execute: 'command', edit: 'edit', delete: 'edit', move: 'edit', read: 'read', search: 'search', fetch: 'fetch' };

// folders: as outras pastas do workspace (ver workspaceFolders.ts). No Cursor a opção é do `agent`,
// antes do `acp` (o `agent acp --help` não lista opção nenhuma); no Antigravity, do `acp`, depois dele.
export function launchArgs(provider: ProviderId, folders: string[] = []): string[] {
  const dirs = folderArgs(provider, folders);
  if (provider === 'gemini') return ['--acp', ...dirs];
  return provider === 'antigravity' ? ['acp', ...dirs] : [...dirs, 'acp'];
}

// Login de cada agente no ACP. Gemini: a chave (no ambiente). Cursor: o login do terminal ou a chave
// (também no ambiente). Antigravity: só a conta por chave se apresenta; a principal usa o login
// guardado, e o `authenticate` dela abriria a página da Google (isso é da tela de Contas).
function authMethod(provider: ProviderId, env: Record<string, string>): string | null {
  if (provider === 'cursor') return 'cursor_login';
  if (provider === 'gemini') return 'gemini-api-key';
  return env.GEMINI_API_KEY ? 'gemini-api-key' : null;
}

// Abre o agente e se apresenta. Usado também para listar modelos (models.ts).
export async function openAcp(provider: ProviderId, account: string, cwd: string, folders: string[] = []): Promise<JsonRpcProcess> {
  const launch = providerLaunch(provider, launchArgs(provider, folders), account);
  if (launch && provider === 'gemini') trustGemini(cwd, launch.env.GEMINI_CLI_HOME);
  if (!launch) throw new Error(tr('O agente não está instalado ou a conta não existe mais.', 'The agent isn’t installed or the account no longer exists.'));
  const rpc = await openAcpProcess(launch, cwd);
  // Uma recusa aqui aparece de novo, com a mensagem do agente, ao criar a sessão.
  const methodId = authMethod(provider, launch.env);
  if (methodId) await rpc.request('authenticate', { methodId }, 30_000).catch(() => {});
  return rpc;
}

export class AcpDriver implements Driver {
  private rpc: JsonRpcProcess | null = null;
  private sessionId = '';
  private info: SessionInfo | null = null;
  private tools = new Map<string, ToolEvent>();
  private writing = false;
  private thinking = false;
  // Durante o session/load o agente reenvia a conversa antiga: o Argus já tem, ignora.
  private loading = false;
  // Antigravity: aviso ("⚠ ...") que chegou como texto da resposta e ainda não foi mostrado. Um erro
  // do pedido (chave recusada, limite) vem assim, sozinho, e o pedido termina como se tivesse dado certo.
  private warning = '';

  constructor(
    private provider: ProviderId,
    private account: string,
    private cwd: string,
    private settings: ChatSettings,
    private events: DriverEvents,
    private folders: string[] = [],
  ) {}

  async start(nativeId?: string): Promise<string> {
    const rpc = await openAcp(this.provider, this.account, this.cwd, this.folders);
    const mcpServers: unknown[] = [];
    this.rpc = rpc;
    rpc.onNotification = (method, params) => {
      if (method === 'session/update') this.update((params as { update: Record<string, unknown> }).update);
    };
    rpc.onRequest = (method, params) => this.request(method, params as Record<string, unknown>);
    rpc.onExit = () => this.events.exited(rpc.lastError() || undefined);
    try {
      if (nativeId) {
        this.loading = true;
        this.info = { sessionId: nativeId, ...(await rpc.request<Omit<SessionInfo, 'sessionId'>>('session/load', { sessionId: nativeId, cwd: this.cwd, mcpServers }, 120_000)) };
      } else this.info = await rpc.request<SessionInfo>('session/new', { cwd: this.cwd, mcpServers }, 120_000);
    } catch (err) {
      throw new Error(friendly(this.provider, rpcDetail(err as RpcError), (err as RpcError).code), { cause: err });
    } finally {
      this.loading = false;
    }
    this.sessionId = this.info.sessionId;
    await this.apply(this.settings, true);
    return this.sessionId;
  }

  async prompt(input: PromptInput): Promise<void> {
    const rpc = this.rpc;
    if (!rpc) throw new Error(tr('O agente não abriu.', 'The agent didn’t open.'));
    // Dados de uso: o Gemini e o Cursor não dizem quantos tokens gastaram, só o pedido conta.
    telemetry.agentTurn(this.provider, this.settings.model || this.fallbackModel() || this.info?.models?.currentModelId || '');
    try {
      const res = await rpc.request<{ stopReason: string }>(
        'session/prompt',
        {
          sessionId: this.sessionId,
          prompt: [{ type: 'text', text: input.text }, ...input.images.map((i) => ({ type: 'image', mimeType: i.mediaType, data: i.data }))],
        },
        // Um pedido pode levar muito tempo trabalhando; quem para é você (cancel).
        24 * 60 * 60_000,
      );
      if (res.stopReason === 'refusal') throw new Error(tr('O agente recusou o pedido.', 'The agent refused the request.'));
      // Só o aviso, sem resposta nenhuma: é o erro do pedido.
      if (this.warning) throw new Error(friendly(this.provider, cleanWarning(this.warning)));
    } catch (err) {
      throw err instanceof RpcError ? new Error(friendly(this.provider, rpcDetail(err), err.code)) : err;
    } finally {
      this.warning = '';
      this.closeText();
      // O pedido gastou do limite da conta: o monitor dela lê de novo (ver usageMonitor/antigravity.ts).
      if (this.provider === 'antigravity') reportAntigravityTurn(this.account);
    }
  }

  async cancel(): Promise<void> {
    this.rpc?.notify('session/cancel', { sessionId: this.sessionId });
  }

  async configure(settings: ChatSettings): Promise<void> {
    const before = this.settings;
    this.settings = settings;
    await this.apply(settings, false, before);
  }

  close(): void {
    this.rpc?.close();
    this.rpc = null;
  }

  // Modelo, esforço e modo de permissão. Pelas opções de configuração do ACP (o Cursor manda "mode"
  // e "model"; o Antigravity, também "thought_level"); sem elas, pelos métodos antigos
  // (session/set_mode, session/set_model). O esforço vai depois do modelo: os níveis mudam com ele.
  private async apply(s: ChatSettings, opening: boolean, before?: ChatSettings): Promise<void> {
    const rpc = this.rpc;
    if (!rpc || !this.info) return;
    const model = s.model || this.fallbackModel();
    const modelChanged = model !== (before?.model || this.fallbackModel());
    if (model && (opening || modelChanged)) await this.set('model', model);
    if (s.effort && (opening || modelChanged || s.effort !== before?.effort) && this.offers(EFFORT_OPTION, s.effort)) await this.set(EFFORT_OPTION, s.effort);
    if (opening || s.permissionMode !== before?.permissionMode) {
      const mode = modeFor(s.permissionMode, this.modes());
      if (mode) await this.set('mode', mode);
    }
  }

  // "Padrão" do Gemini: o "auto" do CLI escolhe um modelo Pro, que a chave do plano gratuito não
  // tem cota para usar, e fica tentando de novo em silêncio (conferido com a 0.63, out/2026). O
  // padrão do Argus é o Flash que responde no gratuito; quem paga escolhe outro no seletor.
  private fallbackModel(): string | undefined {
    if (this.provider !== 'gemini') return undefined;
    const available = this.info?.models?.availableModels.map((m) => m.modelId) ?? [];
    return GEMINI_DEFAULT.find((m) => available.includes(m));
  }

  private modes(): string[] {
    const option = this.info?.configOptions?.find((o) => o.id === 'mode');
    return option ? option.options.map((o) => o.value) : (this.info?.modes?.availableModes.map((m) => m.id) ?? []);
  }

  private offers(id: string, value: string): boolean {
    return !!this.info?.configOptions?.find((o) => o.id === id)?.options.some((o) => o.value === value);
  }

  private async set(id: 'model' | 'mode' | typeof EFFORT_OPTION, value: string): Promise<void> {
    const rpc = this.rpc!;
    const option = this.info?.configOptions?.find((o) => o.id === id);
    try {
      if (option) {
        if (option.currentValue === value) return;
        const res = await rpc.request<{ configOptions?: ConfigOption[] } | null>('session/set_config_option', { sessionId: this.sessionId, configId: id, value });
        option.currentValue = value;
        // A resposta traz as opções de novo: trocar o modelo muda os níveis de esforço dele.
        if (res?.configOptions && this.info) this.info.configOptions = res.configOptions;
      } else if (id === 'mode') await rpc.request('session/set_mode', { sessionId: this.sessionId, modeId: value });
      else if (id === 'model') await rpc.request('session/set_model', { sessionId: this.sessionId, modelId: value });
    } catch (err) {
      console.warn(`[agentChats] ${this.provider} não aceitou ${id}=${value}:`, (err as Error).message);
    }
  }

  private closeText(): void {
    if (this.writing) this.events.textDone();
    if (this.thinking) this.events.thoughtDone();
    this.writing = false;
    this.thinking = false;
  }

  private update(u: Record<string, unknown>): void {
    if (this.loading) return;
    const content = u.content as { type?: string; text?: string } | undefined;
    switch (u.sessionUpdate) {
      case 'agent_message_chunk':
        if (this.thinking) {
          this.thinking = false;
          this.events.thoughtDone();
        }
        return this.say(content?.type === 'text' ? (content.text ?? '') : '');
      case 'agent_thought_chunk':
        if (this.writing) {
          this.writing = false;
          this.events.textDone();
        }
        this.thinking = true;
        return this.events.thought(content?.text ?? '');
      case 'tool_call':
      case 'tool_call_update':
        if (this.warning) this.say('');
        this.closeText();
        return this.tool(u as unknown as AcpTool);
      case 'session_info_update':
        if (typeof u.title === 'string' && u.title) this.events.title(u.title);
        return;
      case 'usage_update': {
        const used = Number(u.used);
        const size = Number(u.size);
        if (used > 0 && size > 0) this.events.usage({ contextPercent: Math.min(100, Math.round((used / size) * 100)) });
        return;
      }
    }
  }

  // Texto da resposta. O aviso do Antigravity espera: se vier resposta depois, ele aparece junto;
  // se o pedido terminar só com ele, vira o erro do pedido (ver prompt).
  private say(text: string): void {
    if (this.provider === 'antigravity' && !this.writing && /^\s*⚠ /.test(text)) {
      this.warning += text;
      return;
    }
    const held = this.warning;
    this.warning = '';
    this.writing = true;
    this.events.text(held + text);
  }

  private tool(t: AcpTool): void {
    const prev = this.tools.get(t.toolCallId);
    const kind = t.kind ?? prev?.name ?? 'other';
    const path = t.locations?.[0]?.path ?? (t.rawInput?.path as string | undefined);
    const command = t.rawInput?.command as string | undefined;
    const title = (t.title ?? '').replace(/`/g, '');
    const diffItem = t.content?.find((c) => c.type === 'diff');
    const text = t.content
      ?.map((c) => (c.type === 'content' && c.content?.type === 'text' ? c.content.text : ''))
      .filter(Boolean)
      .join('\n');
    const done = t.status === 'completed' || t.status === 'failed';
    const out = t.rawOutput;
    const output = out ? [out.stdout ?? out.output, out.stderr].filter(Boolean).join('\n') : '';
    const next: ToolEvent = {
      id: t.toolCallId,
      name: KIND_NAME[kind] ?? prev?.name ?? kind,
      label: KIND_LABEL[kind] ?? prev?.label ?? tr('Ferramenta', 'Tool'),
      input: command ?? (path ? basename(path) : title || prev?.input || ''),
      detail: command ?? path ?? prev?.detail,
      result: (output || text) ? (output || text)!.slice(-8000) : (prev?.result ?? (done ? '' : undefined)),
      error: t.status === 'failed' || (out?.exitCode !== undefined && out.exitCode !== 0),
      diff: diffItem?.newText !== undefined ? fromTexts(diffItem.oldText, diffItem.newText) : prev?.diff,
      done,
    };
    this.tools.set(t.toolCallId, next);
    this.events.tool(next);
  }

  private async request(method: string, p: Record<string, unknown>): Promise<unknown> {
    if (method !== 'session/request_permission') throw new RpcError(`${method} não suportado`, -32601);
    const call = p.toolCall as AcpTool;
    const options = (p.options as { optionId: string; kind: string }[]) ?? [];
    // O texto que vem no pedido é o motivo da pergunta ("Not in allowlist: echo"), não o resultado.
    this.tool({ ...call, content: call.content?.filter((c) => c.type !== 'content'), status: call.status ?? 'pending' });
    const shown = this.tools.get(call.toolCallId);
    let reply: PermissionReply;
    // Modo "Ignorar permissões" ou "Aceitar edições": o app responde sozinho, como o Claude Code faz.
    if (this.settings.permissionMode === 'bypassPermissions') reply = 'allow';
    else if (this.settings.permissionMode === 'acceptEdits' && shown?.name === 'edit') reply = 'allow';
    else
      reply = await this.events.permission({
        toolName: shown?.name ?? 'tool',
        label: shown?.label ?? tr('Ferramenta', 'Tool'),
        summary: (call.title ?? shown?.input ?? '').replace(/`/g, ''),
        detail: shown?.detail,
        diff: shown?.diff,
        canAlwaysAllow: options.some((o) => o.kind === 'allow_always'),
      });
    const pick = (...kinds: string[]) => kinds.map((k) => options.find((o) => o.kind === k)).find(Boolean);
    const option =
      reply === 'always' ? pick('allow_always', 'allow_once') : reply === 'allow' ? pick('allow_once', 'allow_always') : pick('reject_once', 'reject_always');
    return option ? { outcome: { outcome: 'selected', optionId: option.optionId } } : { outcome: { outcome: 'cancelled' } };
  }
}

export const GEMINI_DEFAULT = ['gemini-3-flash-preview', 'gemini-3.5-flash'];

// Opção de configuração do esforço (o "Thinking Level" do Antigravity).
export const EFFORT_OPTION = 'thought_level';

// Modo do app → modo do agente, pelo que ele oferece.
function modeFor(mode: string, available: string[]): string | undefined {
  const first = (...ids: string[]) => ids.find((id) => available.includes(id));
  if (mode === 'plan') return first('plan');
  if (mode === 'bypassPermissions') return first('yolo', 'agent', 'default');
  if (mode === 'acceptEdits') return first('autoEdit', 'auto_edit', 'accept-edits', 'agent', 'default');
  return first('default', 'agent');
}

const rpcDetail = (err: RpcError): string => (err.data as { message?: string } | undefined)?.message ?? err.message;

// "⚠ agent executor error: generating and executing: Error 400, Message: ..." → só o motivo.
const cleanWarning = (text: string): string =>
  text
    .trim()
    .replace(/^⚠\s*/, '')
    .replace(/^agent executor error:\s*(generating and executing:\s*)?/i, '')
    .slice(0, 600);

const LIMIT: Record<ProviderId, string> = {
  codex: '',
  gemini: tr(
    'A chave do Gemini está sem cota para este modelo. No plano gratuito do Google, os modelos Pro não têm cota: escolha o Gemini 3 Flash no seletor de modelo ou ative o faturamento no Google AI Studio.',
    'The Gemini key has no quota for this model. On Google’s free tier, Pro models have no quota: pick Gemini 3 Flash in the model picker or enable billing in Google AI Studio.',
  ),
  antigravity: tr(
    'O Antigravity atingiu o limite de uso desta conta para este modelo. Tente mais tarde ou troque de modelo.',
    'Antigravity hit this account’s usage limit for this model. Try later or switch models.',
  ),
  cursor: tr('O Cursor atingiu o limite de uso do plano. Tente mais tarde ou troque de modelo.', 'Cursor hit the plan’s usage limit. Try later or switch models.'),
};

const SIGN_IN: Record<ProviderId, string> = {
  codex: '',
  gemini: tr('O Gemini recusou a chave desta conta. Troque a chave em Configurações > Contas.', 'Gemini rejected this account’s key. Replace it in Settings > Accounts.'),
  antigravity: tr(
    'O Antigravity recusou o login (ou a chave) desta conta. Entre de novo em Configurações > Contas.',
    'Antigravity rejected this account’s sign-in (or key). Sign in again in Settings > Accounts.',
  ),
  cursor: tr('O Cursor pediu login de novo. Entre em Configurações > Contas.', 'Cursor asked to sign in again. Go to Settings > Accounts.'),
};

// Erro do agente em português, quando dá para reconhecer.
function friendly(provider: ProviderId, detail: string, code?: number): string {
  if (code === 429 || /quota|rate.?limit|429|resource_exhausted|usage limit/i.test(detail)) return LIMIT[provider] || detail;
  if (/auth|login|api key|unauthorized|401/i.test(detail)) return SIGN_IN[provider] || detail;
  return detail;
}
