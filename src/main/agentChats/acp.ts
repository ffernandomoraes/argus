import { basename } from 'node:path'
import { app } from 'electron'
import type { ChatSettings } from '../../shared/chat'
import type { ProviderId } from '../../shared/providers'
import { tr } from '../i18n'
import { providerLaunch } from '../providers/env'
import { JsonRpcProcess, RpcError } from '../providers/rpc'
import { fromTexts } from './diff'
import type { Driver, DriverEvents, PermissionReply, PromptInput, ToolEvent } from './driver'

// Gemini (`gemini --acp`) e Cursor (`agent acp`) pelo Agent Client Protocol, o protocolo aberto do
// Zed para editores falarem com agentes (agentclientprotocol.com). JSON-RPC na entrada e saída
// padrão: session/new (ou load), session/prompt e os avisos session/update. O app não oferece
// arquivos nem terminal ao agente: cada um usa os próprios (conferido com o Cursor 2026.10.14 e o
// Gemini 0.63).

type SelectOption = { value: string; name: string; description?: string }
export type ConfigOption = { id: string; name: string; category?: string; type: string; currentValue: string; options: SelectOption[] }
type SessionInfo = {
  sessionId: string
  modes?: { currentModeId: string; availableModes: { id: string; name: string }[] }
  models?: { currentModelId: string; availableModels: { modelId: string; name: string }[] }
  configOptions?: ConfigOption[]
}

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
}

const KIND_LABEL: Record<string, string> = {
  read: tr('Ler', 'Read'),
  edit: tr('Editar', 'Edit'),
  delete: tr('Apagar', 'Delete'),
  move: tr('Mover', 'Move'),
  search: tr('Buscar', 'Search'),
  execute: tr('Comando', 'Command'),
  think: tr('Pensar', 'Think'),
  fetch: tr('Buscar na web', 'Fetch'),
  switch_mode: tr('Trocar modo', 'Switch mode')
}

const KIND_NAME: Record<string, string> = { execute: 'command', edit: 'edit', delete: 'edit', move: 'edit', read: 'read', search: 'search', fetch: 'fetch' }

export function launchArgs(provider: ProviderId): string[] {
  return provider === 'gemini' ? ['--acp'] : ['acp']
}

// Abre o agente e se apresenta. Usado também para listar modelos (models.ts).
export async function openAcp(provider: ProviderId, account: string, cwd: string): Promise<JsonRpcProcess> {
  const launch = providerLaunch(provider, launchArgs(provider), account)
  if (!launch) throw new Error(tr('O agente não está instalado ou a conta não existe mais.', 'The agent isn’t installed or the account no longer exists.'))
  const rpc = new JsonRpcProcess(launch, cwd)
  await rpc.request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'argus', title: 'Argus', version: app.getVersion() }
  })
  // Login: o Gemini pela chave (no ambiente); o Cursor pelo login do terminal ou pela chave (também
  // no ambiente). Uma recusa aqui aparece de novo, com a mensagem do agente, ao criar a sessão.
  const methodId = provider === 'gemini' ? 'gemini-api-key' : 'cursor_login'
  await rpc.request('authenticate', { methodId }, 30_000).catch(() => {})
  return rpc
}

export class AcpDriver implements Driver {
  private rpc: JsonRpcProcess | null = null
  private sessionId = ''
  private info: SessionInfo | null = null
  private tools = new Map<string, ToolEvent>()
  private writing = false
  private thinking = false
  // Durante o session/load o agente reenvia a conversa antiga: o Argus já tem, ignora.
  private loading = false

  constructor(
    private provider: ProviderId,
    private account: string,
    private cwd: string,
    private settings: ChatSettings,
    private events: DriverEvents
  ) {}

  async start(nativeId?: string): Promise<string> {
    const rpc = await openAcp(this.provider, this.account, this.cwd)
    this.rpc = rpc
    rpc.onNotification = (method, params) => method === 'session/update' && this.update((params as { update: Record<string, unknown> }).update)
    rpc.onRequest = (method, params) => this.request(method, params as Record<string, unknown>)
    rpc.onExit = () => this.events.exited(rpc.lastError() || undefined)
    try {
      if (nativeId) {
        this.loading = true
        this.info = { sessionId: nativeId, ...(await rpc.request<Omit<SessionInfo, 'sessionId'>>('session/load', { sessionId: nativeId, cwd: this.cwd, mcpServers: [] }, 120_000)) }
      } else this.info = await rpc.request<SessionInfo>('session/new', { cwd: this.cwd, mcpServers: [] }, 120_000)
    } catch (err) {
      throw new Error(friendly(this.provider, err as RpcError))
    } finally {
      this.loading = false
    }
    this.sessionId = this.info.sessionId
    await this.apply(this.settings, true)
    return this.sessionId
  }

  async prompt(input: PromptInput): Promise<void> {
    const rpc = this.rpc
    if (!rpc) throw new Error(tr('O agente não abriu.', 'The agent didn’t open.'))
    try {
      const res = await rpc.request<{ stopReason: string }>(
        'session/prompt',
        {
          sessionId: this.sessionId,
          prompt: [{ type: 'text', text: input.text }, ...input.images.map((i) => ({ type: 'image', mimeType: i.mediaType, data: i.data }))]
        },
        // Um pedido pode levar muito tempo trabalhando; quem para é você (cancel).
        24 * 60 * 60_000
      )
      if (res.stopReason === 'refusal') throw new Error(tr('O agente recusou o pedido.', 'The agent refused the request.'))
    } catch (err) {
      throw err instanceof RpcError ? new Error(friendly(this.provider, err)) : err
    } finally {
      this.closeText()
    }
  }

  async cancel(): Promise<void> {
    this.rpc?.notify('session/cancel', { sessionId: this.sessionId })
  }

  async configure(settings: ChatSettings): Promise<void> {
    const before = this.settings
    this.settings = settings
    await this.apply(settings, false, before)
  }

  close(): void {
    this.rpc?.close()
    this.rpc = null
  }

  // Modelo e modo de permissão. Pelas opções de configuração do ACP (o Cursor manda "mode" e
  // "model"); sem elas, pelos métodos antigos (session/set_mode, session/set_model).
  private async apply(s: ChatSettings, opening: boolean, before?: ChatSettings): Promise<void> {
    const rpc = this.rpc
    if (!rpc || !this.info) return
    const model = s.model || this.fallbackModel()
    if (model && (opening || model !== (before?.model || this.fallbackModel()))) await this.set('model', model)
    if (opening || s.permissionMode !== before?.permissionMode) {
      const mode = modeFor(s.permissionMode, this.modes())
      if (mode) await this.set('mode', mode)
    }
  }

  // "Padrão" do Gemini: o "auto" do CLI escolhe um modelo Pro, que a chave do plano gratuito não
  // tem cota para usar, e fica tentando de novo em silêncio (conferido com a 0.63, out/2026). O
  // padrão do Argus é o Flash que responde no gratuito; quem paga escolhe outro no seletor.
  private fallbackModel(): string | undefined {
    if (this.provider !== 'gemini') return undefined
    const available = this.info?.models?.availableModels.map((m) => m.modelId) ?? []
    return GEMINI_DEFAULT.find((m) => available.includes(m))
  }

  private modes(): string[] {
    const option = this.info?.configOptions?.find((o) => o.id === 'mode')
    return option ? option.options.map((o) => o.value) : (this.info?.modes?.availableModes.map((m) => m.id) ?? [])
  }

  private async set(id: 'model' | 'mode', value: string): Promise<void> {
    const rpc = this.rpc!
    const option = this.info?.configOptions?.find((o) => o.id === id)
    try {
      if (option) {
        if (option.currentValue === value) return
        await rpc.request('session/set_config_option', { sessionId: this.sessionId, configId: id, value })
        option.currentValue = value
      } else if (id === 'mode') await rpc.request('session/set_mode', { sessionId: this.sessionId, modeId: value })
      else await rpc.request('session/set_model', { sessionId: this.sessionId, modelId: value })
    } catch (err) {
      console.warn(`[agentChats] ${this.provider} não aceitou ${id}=${value}:`, (err as Error).message)
    }
  }

  private closeText(): void {
    if (this.writing) this.events.textDone()
    if (this.thinking) this.events.thoughtDone()
    this.writing = false
    this.thinking = false
  }

  private update(u: Record<string, unknown>): void {
    if (this.loading) return
    const content = u.content as { type?: string; text?: string } | undefined
    switch (u.sessionUpdate) {
      case 'agent_message_chunk':
        if (this.thinking) {
          this.thinking = false
          this.events.thoughtDone()
        }
        this.writing = true
        return this.events.text(content?.type === 'text' ? (content.text ?? '') : '')
      case 'agent_thought_chunk':
        if (this.writing) {
          this.writing = false
          this.events.textDone()
        }
        this.thinking = true
        return this.events.thought(content?.text ?? '')
      case 'tool_call':
      case 'tool_call_update':
        this.closeText()
        return this.tool(u as unknown as AcpTool)
      case 'session_info_update':
        if (typeof u.title === 'string' && u.title) this.events.title(u.title)
        return
      case 'usage_update': {
        const used = Number(u.used)
        const size = Number(u.size)
        if (used > 0 && size > 0) this.events.usage({ contextPercent: Math.min(100, Math.round((used / size) * 100)) })
        return
      }
    }
  }

  private tool(t: AcpTool): void {
    const prev = this.tools.get(t.toolCallId)
    const kind = t.kind ?? prev?.name ?? 'other'
    const path = t.locations?.[0]?.path ?? (t.rawInput?.path as string | undefined)
    const command = t.rawInput?.command as string | undefined
    const title = (t.title ?? '').replace(/`/g, '')
    const diffItem = t.content?.find((c) => c.type === 'diff')
    const text = t.content
      ?.map((c) => (c.type === 'content' && c.content?.type === 'text' ? c.content.text : ''))
      .filter(Boolean)
      .join('\n')
    const done = t.status === 'completed' || t.status === 'failed'
    const out = t.rawOutput
    const output = out ? [out.stdout ?? out.output, out.stderr].filter(Boolean).join('\n') : ''
    const next: ToolEvent = {
      id: t.toolCallId,
      name: KIND_NAME[kind] ?? prev?.name ?? kind,
      label: KIND_LABEL[kind] ?? prev?.label ?? tr('Ferramenta', 'Tool'),
      input: command ?? (path ? basename(path) : title || prev?.input || ''),
      detail: command ?? path ?? prev?.detail,
      result: (output || text) ? (output || text)!.slice(-8000) : (prev?.result ?? (done ? '' : undefined)),
      error: t.status === 'failed' || (out?.exitCode !== undefined && out.exitCode !== 0),
      diff: diffItem?.newText !== undefined ? fromTexts(diffItem.oldText, diffItem.newText) : prev?.diff,
      done
    }
    this.tools.set(t.toolCallId, next)
    this.events.tool(next)
  }

  private async request(method: string, p: Record<string, unknown>): Promise<unknown> {
    if (method !== 'session/request_permission') throw new RpcError(`${method} não suportado`, -32601)
    const call = p.toolCall as AcpTool
    const options = (p.options as { optionId: string; kind: string }[]) ?? []
    // O texto que vem no pedido é o motivo da pergunta ("Not in allowlist: echo"), não o resultado.
    this.tool({ ...call, content: call.content?.filter((c) => c.type !== 'content'), status: call.status ?? 'pending' })
    const shown = this.tools.get(call.toolCallId)
    let reply: PermissionReply
    // Modo "Ignorar permissões" ou "Aceitar edições": o app responde sozinho, como o Claude Code faz.
    if (this.settings.permissionMode === 'bypassPermissions') reply = 'allow'
    else if (this.settings.permissionMode === 'acceptEdits' && shown?.name === 'edit') reply = 'allow'
    else
      reply = await this.events.permission({
        toolName: shown?.name ?? 'tool',
        label: shown?.label ?? tr('Ferramenta', 'Tool'),
        summary: (call.title ?? shown?.input ?? '').replace(/`/g, ''),
        detail: shown?.detail,
        diff: shown?.diff,
        canAlwaysAllow: options.some((o) => o.kind === 'allow_always')
      })
    const pick = (...kinds: string[]) => kinds.map((k) => options.find((o) => o.kind === k)).find(Boolean)
    const option =
      reply === 'always' ? pick('allow_always', 'allow_once') : reply === 'allow' ? pick('allow_once', 'allow_always') : pick('reject_once', 'reject_always')
    return option ? { outcome: { outcome: 'selected', optionId: option.optionId } } : { outcome: { outcome: 'cancelled' } }
  }
}

export const GEMINI_DEFAULT = ['gemini-3-flash-preview', 'gemini-3.5-flash']

// Modo do app → modo do agente, pelo que ele oferece.
function modeFor(mode: string, available: string[]): string | undefined {
  const first = (...ids: string[]) => ids.find((id) => available.includes(id))
  if (mode === 'plan') return first('plan')
  if (mode === 'bypassPermissions') return first('yolo', 'agent', 'default')
  if (mode === 'acceptEdits') return first('autoEdit', 'auto_edit', 'agent', 'default')
  return first('default', 'agent')
}

// Erro do agente em português, quando dá para reconhecer.
function friendly(provider: ProviderId, err: RpcError): string {
  const detail = (err.data as { message?: string } | undefined)?.message ?? err.message
  if (err.code === 429 || /quota|rate.?limit|429/i.test(detail))
    return provider === 'gemini'
      ? tr(
          'A chave do Gemini está sem cota para este modelo. No plano gratuito do Google, os modelos Pro não têm cota: escolha o Gemini 3 Flash no seletor de modelo ou ative o faturamento no Google AI Studio.',
          'The Gemini key has no quota for this model. On Google’s free tier, Pro models have no quota: pick Gemini 3 Flash in the model picker or enable billing in Google AI Studio.'
        )
      : tr('O Cursor atingiu o limite de uso do plano. Tente mais tarde ou troque de modelo.', 'Cursor hit the plan’s usage limit. Try later or switch models.')
  if (/auth|login|api key|unauthorized|401/i.test(detail))
    return provider === 'gemini'
      ? tr('O Gemini recusou a chave desta conta. Troque a chave em Configurações > Contas.', 'Gemini rejected this account’s key. Replace it in Settings > Accounts.')
      : tr('O Cursor pediu login de novo. Entre em Configurações > Contas.', 'Cursor asked to sign in again. Go to Settings > Accounts.')
  return detail
}

