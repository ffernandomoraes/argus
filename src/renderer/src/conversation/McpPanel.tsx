import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Lock, Power, RefreshCw, RotateCw } from 'lucide-react'
import type { McpServer, McpStatus } from '../../../shared/mcp'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { tr } from '../i18n'

// Como cada estado aparece. A ordem aqui é a ordem das seções no painel.
const GROUPS = [
  { status: 'connected', label: tr('Conectados', 'Connected'), icon: Check, tone: 'text-emerald-400' },
  { status: 'needs-auth', label: tr('Precisam de autorização', 'Need authorization'), icon: Lock, tone: 'text-needs-you' },
  { status: 'failed', label: tr('Com erro', 'Failed'), icon: AlertTriangle, tone: 'text-red-400' },
  { status: 'pending', label: tr('Conectando', 'Connecting'), icon: Loader2, tone: 'text-running' },
  { status: 'disabled', label: tr('Desligados', 'Disabled'), icon: Power, tone: 'text-faint' }
] as const

const HINT: Partial<Record<McpServer['status'], string>> = {
  'needs-auth': tr(
    'Autorize em uma conversa do Claude Code com o comando /mcp, ou nas configurações do serviço.',
    'Authorize in a Claude Code chat with the /mcp command, or in the service’s settings.'
  ),
  failed: tr('O Claude não conseguiu conectar. Veja o erro de cada um abaixo.', 'Claude couldn’t connect. See each error below.')
}

// Enquanto algum servidor conecta (ou reconecta), o painel pergunta de novo neste intervalo.
const POLL_MS = 1000

// onReconnect: só com a sessão da conversa aberta (sem ela, não há conexão para refazer).
function ServerRow({ server, reconnecting, onReconnect }: { server: McpServer; reconnecting: boolean; onReconnect?: () => void }) {
  return (
    <li className="group rounded-md px-2 py-1.5 hover:bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs text-text">{server.name}</span>
        {server.tools > 0 && (
          <span className="shrink-0 text-[11px] text-faint">
            {server.tools === 1 ? tr('1 ferramenta', '1 tool') : tr(`${server.tools} ferramentas`, `${server.tools} tools`)}
          </span>
        )}
        {server.scope && <span className="ml-auto shrink-0 text-[11px] text-faint">{server.scope}</span>}
        {onReconnect && server.status !== 'disabled' && (
          <button
            onClick={onReconnect}
            disabled={reconnecting}
            // Com erro ou sem autorização, à vista; nos outros, ao passar o mouse.
            className={`${server.scope ? '' : 'ml-auto '}flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-fill hover:text-text disabled:opacity-100 ${
              reconnecting || server.status === 'failed' || server.status === 'needs-auth' ? '' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {reconnecting ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
            {reconnecting ? tr('Reconectando…', 'Reconnecting…') : tr('Reconectar', 'Reconnect')}
          </button>
        )}
      </div>
      {server.error && <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{server.error}</p>}
    </li>
  )
}

// Lista dos servidores MCP da pasta, no lugar do /mcp que abriria uma tela no terminal. Cada conta
// tem os seus: sem conversa aberta, a consulta usa a conta do grupo.
export function McpPanel({
  conversationKey,
  cwd,
  account,
  onClose
}: {
  conversationKey: string
  cwd: string
  account?: string
  onClose: () => void
}) {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [loading, setLoading] = useState(true)
  // Servidores reconectando agora (pelo botão de cada um).
  const [reconnecting, setReconnecting] = useState<ReadonlySet<string>>(new Set())
  const [reconnectError, setReconnectError] = useState<string | null>(null)

  // Pergunta aos servidores; a resposta (ou o erro dela) troca a lista e tira o "carregando".
  const fetchStatus = useCallback(
    () =>
      window.api.chat.mcpStatus(conversationKey, cwd, account).then(
        (s) => s,
        (err: unknown): McpStatus => ({ ok: false, error: err instanceof Error ? err.message : String(err) })
      ),
    [conversationKey, cwd, account]
  )

  useEffect(() => {
    let alive = true
    void fetchStatus().then((s) => {
      if (!alive) return
      setStatus(s)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [fetchStatus])

  const refresh = () => {
    setLoading(true)
    void fetchStatus().then((s) => {
      setStatus(s)
      setLoading(false)
    })
  }

  const servers = status?.ok ? status.servers : []
  const live = status?.ok === true && status.live

  // Com a sessão aberta, a lista vem na hora; enquanto alguém conecta, pergunta de novo sozinho.
  const connecting = live && (reconnecting.size > 0 || servers.some((x) => x.status === 'pending'))
  useEffect(() => {
    if (!connecting) return
    const timer = setTimeout(() => void fetchStatus().then(setStatus), POLL_MS)
    return () => clearTimeout(timer)
  }, [connecting, status, fetchStatus])

  const reconnect = (name: string) => {
    setReconnectError(null)
    setReconnecting((r) => new Set(r).add(name))
    void window.api.chat
      .mcpReconnect(conversationKey, name)
      .then(
        (s) => (s.ok ? setStatus(s) : setReconnectError(s.error)),
        (err: unknown) => setReconnectError(err instanceof Error ? err.message : String(err))
      )
      .finally(() =>
        setReconnecting((r) => {
          const next = new Set(r)
          next.delete(name)
          return next
        })
      )
  }

  return (
    <Modal
      label={tr('Servidores MCP', 'MCP servers')}
      size="auto"
      className="flex h-[min(560px,100%)] w-[min(520px,100%)] flex-col"
      onClose={onClose}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{tr('Servidores MCP', 'MCP servers')}</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-faint">{cwd}</div>
        </div>
        <IconButton label={tr('Atualizar', 'Refresh')} onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </IconButton>
        <ModalCloseButton />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && servers.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-8 text-xs text-faint">
            <Loader2 size={13} className="animate-spin" />
            {tr('Perguntando aos servidores…', 'Asking the servers…')}
          </p>
        )}
        {status && !status.ok && <p className="px-2 py-4 text-xs text-red-400">{status.error}</p>}
        {reconnectError && <p className="px-2 pb-3 text-xs text-red-400">{reconnectError}</p>}
        {status?.ok && !live && servers.length > 0 && (
          <p className="mb-3 px-2 text-[12px] leading-snug text-faint">
            {tr(
              'Esta conversa ainda não abriu o agente: a lista mostra como os servidores ficam ao abrir. Para reconectar um, mande uma mensagem antes.',
              'This chat hasn’t started the agent yet: the list shows how the servers look when it starts. To reconnect one, send a message first.'
            )}
          </p>
        )}
        {status?.ok && servers.length === 0 && !loading && (
          <p className="px-2 py-4 text-xs text-faint">{tr('Nenhum servidor MCP configurado para esta pasta.', 'No MCP servers configured for this folder.')}</p>
        )}
        {GROUPS.map(({ status: s, label, icon: Icon, tone }) => {
          const list = servers.filter((x) => x.status === s)
          if (!list.length) return null
          return (
            <section key={s} className="mb-4 last:mb-0">
              <div className="mb-1 flex items-center gap-2 px-2">
                <Icon size={12} className={`shrink-0 ${tone} ${s === 'pending' ? 'animate-spin' : ''}`} />
                <span className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</span>
                <span className="text-[12px] text-faint">{list.length}</span>
              </div>
              {HINT[s] && <p className="mb-1 px-2 text-[12px] leading-snug text-faint">{HINT[s]}</p>}
              <ul className="flex flex-col">
                {list.map((server) => (
                  <ServerRow
                    key={server.name}
                    server={server}
                    reconnecting={reconnecting.has(server.name)}
                    onReconnect={live ? () => reconnect(server.name) : undefined}
                  />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
