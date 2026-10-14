import { basename } from 'node:path'
import type { ChatSettings } from '../../shared/chat'
import { tr } from '../i18n'
import { providerLaunch } from '../providers/env'
import { RpcError, type JsonRpcProcess } from '../providers/rpc'
import { openCodex } from '../providers/status'
import { reportCodexRateLimits } from '../usageMonitor/codex'
import type { CodexSnapshot } from '../usageMonitor/codexParse'
import { fromUnified } from './diff'
import type { Driver, DriverEvents, PromptInput, ToolEvent } from './driver'

// Codex pelo app-server (JSON-RPC na entrada e saída padrão), o mesmo caminho da extensão do VS
// Code. Uma conversa do Argus = uma thread do Codex; cada envio = um turn. Os eventos chegam como
// item/started, deltas e item/completed (conferido na 0.162.1).

type Item = { type: string; id: string; [k: string]: unknown }
type Turn = { id: string; status: 'completed' | 'interrupted' | 'failed' | 'inProgress'; error?: { message: string } | null }

// Modo de permissão do app → política de aprovação e área de escrita do Codex.
function policies(mode: string): { approvalPolicy: string; sandboxPolicy: object; sandbox: string } {
  if (mode === 'bypassPermissions') return { approvalPolicy: 'never', sandboxPolicy: { type: 'dangerFullAccess' }, sandbox: 'danger-full-access' }
  if (mode === 'plan') return { approvalPolicy: 'on-request', sandboxPolicy: { type: 'readOnly', networkAccess: false }, sandbox: 'read-only' }
  return {
    approvalPolicy: 'on-request',
    sandboxPolicy: { type: 'workspaceWrite', writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false },
    sandbox: 'workspace-write'
  }
}

const clip = (s: string, n = 120) => (s.length > n ? s.slice(0, n) + '…' : s)

export class CodexDriver implements Driver {
  private rpc: JsonRpcProcess | null = null
  private threadId = ''
  private turnId: string | null = null
  private turnDone: ((t: Turn) => void) | null = null
  private lastError: string | null = null
  // Edições vistas no item/started: o pedido de aprovação delas só traz o id.
  private changes = new Map<string, ToolEvent>()
  // Conta que abriu de fato (a padrão, quando a conversa não diz qual): os limites vão para ela.
  private accountId = ''

  constructor(
    private account: string,
    private cwd: string,
    private settings: ChatSettings,
    private events: DriverEvents
  ) {}

  async start(nativeId?: string): Promise<string> {
    const launch = providerLaunch('codex', ['app-server'], this.account)
    if (!launch) throw new Error(tr('O Codex não está instalado ou a conta não existe mais.', 'Codex isn’t installed or the account no longer exists.'))
    this.accountId = launch.account
    const rpc = await openCodex(launch, this.cwd)
    this.rpc = rpc
    rpc.onNotification = (method, params) => this.notify(method, params as Record<string, unknown>)
    rpc.onRequest = (method, params) => this.request(method, params as Record<string, unknown>)
    rpc.onExit = () => {
      this.turnDone?.({ id: this.turnId ?? '', status: 'failed', error: { message: rpc.lastError() || tr('O Codex fechou.', 'Codex closed.') } })
      this.events.exited(rpc.lastError() || undefined)
    }
    const p = policies(this.settings.permissionMode)
    const common = { cwd: this.cwd, approvalPolicy: p.approvalPolicy, sandbox: p.sandbox, ...(this.settings.model && { model: this.settings.model }) }
    const res = nativeId
      ? await rpc.request<{ thread: { id: string } }>('thread/resume', { threadId: nativeId, excludeTurns: true, ...common })
      : await rpc.request<{ thread: { id: string } }>('thread/start', common)
    this.threadId = res.thread.id
    return this.threadId
  }

  async prompt(input: PromptInput): Promise<void> {
    const rpc = this.rpc
    if (!rpc) throw new Error(tr('O Codex não abriu.', 'Codex didn’t open.'))
    this.lastError = null
    const p = policies(this.settings.permissionMode)
    const done = new Promise<Turn>((resolve) => (this.turnDone = resolve))
    const res = await rpc.request<{ turn: Turn }>('turn/start', {
      threadId: this.threadId,
      input: [
        { type: 'text', text: input.text, text_elements: [] },
        ...input.images.map((i) => ({ type: 'image', url: `data:${i.mediaType};base64,${i.data}` }))
      ],
      approvalPolicy: p.approvalPolicy,
      sandboxPolicy: p.sandboxPolicy,
      ...(this.settings.model && { model: this.settings.model }),
      ...(this.settings.effort && { effort: this.settings.effort })
    })
    this.turnId = res.turn.id
    const turn = await done
    this.turnDone = null
    this.turnId = null
    if (turn.status === 'failed') throw new Error(turn.error?.message || this.lastError || tr('O Codex não terminou o pedido.', 'Codex didn’t finish the request.'))
  }

  async cancel(): Promise<void> {
    if (this.rpc && this.turnId) await this.rpc.request('turn/interrupt', { threadId: this.threadId, turnId: this.turnId }).catch(() => {})
  }

  // Modelo, esforço e modo valem a partir do próximo pedido (vão em cada turn/start).
  async configure(settings: ChatSettings): Promise<void> {
    this.settings = settings
  }

  close(): void {
    this.rpc?.close()
    this.rpc = null
  }

  private notify(method: string, p: Record<string, unknown>): void {
    switch (method) {
      case 'item/agentMessage/delta':
        return this.events.text(String(p.delta ?? ''))
      case 'item/reasoning/summaryTextDelta':
      case 'item/reasoning/textDelta':
        return this.events.thought(String(p.delta ?? ''))
      case 'item/started':
        return this.itemStarted(p.item as Item)
      case 'item/completed':
        return this.itemCompleted(p.item as Item)
      case 'thread/tokenUsage/updated': {
        const u = p.tokenUsage as { last?: { totalTokens: number; outputTokens: number }; modelContextWindow?: number | null }
        const window = u.modelContextWindow
        return this.events.usage({
          contextPercent: window && u.last ? Math.min(100, Math.round((u.last.totalTokens / window) * 100)) : undefined,
          turnTokens: u.last?.outputTokens
        })
      }
      // Limites da conta depois de cada pedido: a barra de uso muda na hora (ver usageMonitor/codex.ts).
      case 'account/rateLimits/updated':
        if (p.rateLimits) reportCodexRateLimits(this.accountId, p.rateLimits as CodexSnapshot)
        return
      case 'thread/name/updated':
        if (typeof p.threadName === 'string' && p.threadName) this.events.title(p.threadName)
        return
      case 'error': {
        const e = p as { error?: { message?: string }; willRetry?: boolean }
        if (!e.willRetry && e.error?.message) this.lastError = e.error.message
        return
      }
      case 'turn/completed': {
        const turn = p.turn as Turn
        if (!this.turnId || turn.id === this.turnId) this.turnDone?.(turn)
        return
      }
    }
  }

  private itemStarted(item: Item): void {
    const tool = toolOf(item, false)
    if (!tool) return
    if (item.type === 'fileChange') this.changes.set(item.id, tool)
    this.events.tool(tool)
  }

  private itemCompleted(item: Item): void {
    if (item.type === 'agentMessage') return this.events.textDone()
    if (item.type === 'reasoning') return this.events.thoughtDone()
    const tool = toolOf(item, true)
    if (!tool) return
    this.changes.delete(item.id)
    this.events.tool(tool)
  }

  // Pedidos do Codex para o app: aprovações. O resto volta como erro (o app ainda não pergunta outras
  // coisas), e o Codex segue sem.
  private async request(method: string, p: Record<string, unknown>): Promise<unknown> {
    if (method === 'item/commandExecution/requestApproval') {
      const command = String(p.command ?? '')
      const reply = await this.events.permission({
        toolName: 'command',
        label: tr('Comando', 'Command'),
        summary: String(p.reason ?? clip(command)),
        detail: command,
        canAlwaysAllow: true
      })
      return { decision: reply === 'always' ? 'acceptForSession' : reply === 'allow' ? 'accept' : 'decline' }
    }
    if (method === 'item/fileChange/requestApproval') {
      const change = this.changes.get(String(p.itemId))
      const reply = await this.events.permission({
        toolName: 'edit',
        label: tr('Editar', 'Edit'),
        summary: String(p.reason ?? change?.input ?? tr('Editar arquivos', 'Edit files')),
        detail: change?.detail,
        diff: change?.diff,
        canAlwaysAllow: true
      })
      return { decision: reply === 'always' ? 'acceptForSession' : reply === 'allow' ? 'accept' : 'decline' }
    }
    throw new RpcError(`${method} não suportado`, -32601)
  }
}

// Item do Codex que vira linha de ferramenta no chat.
function toolOf(item: Item, done: boolean): ToolEvent | null {
  if (item.type === 'commandExecution') {
    const command = String(item.command ?? '')
    const exit = item.exitCode as number | null
    return {
      id: item.id,
      name: 'command',
      label: tr('Comando', 'Command'),
      input: clip(command),
      detail: command,
      result: done ? String(item.aggregatedOutput ?? '').slice(-8000) : undefined,
      error: done && ((exit !== null && exit !== 0) || item.status === 'failed' || item.status === 'declined'),
      done
    }
  }
  if (item.type === 'fileChange') {
    const changes = (item.changes as { path: string; diff: string }[]) ?? []
    const first = changes[0]
    return {
      id: item.id,
      name: 'edit',
      label: tr('Editar', 'Edit'),
      input: changes.map((c) => basename(c.path)).join(', '),
      detail: changes.map((c) => c.path).join('\n'),
      diff: first ? fromUnified(first.diff) : undefined,
      result: done ? '' : undefined,
      error: done && (item.status === 'failed' || item.status === 'declined'),
      done
    }
  }
  if (item.type === 'mcpToolCall') {
    return {
      id: item.id,
      name: 'mcp',
      label: `${item.server}`,
      input: String(item.tool ?? ''),
      detail: JSON.stringify(item.arguments ?? {}).slice(0, 2000),
      result: done ? JSON.stringify(item.result ?? item.error ?? '').slice(0, 4000) : undefined,
      error: done && item.status === 'failed',
      done
    }
  }
  if (item.type === 'webSearch') {
    return { id: item.id, name: 'search', label: tr('Busca na web', 'Web search'), input: String(item.query ?? ''), result: done ? '' : undefined, done }
  }
  return null
}
