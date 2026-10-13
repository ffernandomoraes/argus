import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Lock, Power, RefreshCw } from 'lucide-react'
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

function ServerRow({ server }: { server: McpServer }) {
  return (
    <li className="rounded-md px-2 py-1.5 hover:bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs text-text">{server.name}</span>
        {server.tools > 0 && (
          <span className="shrink-0 text-[11px] text-faint">
            {server.tools === 1 ? tr('1 ferramenta', '1 tool') : tr(`${server.tools} ferramentas`, `${server.tools} tools`)}
          </span>
        )}
        {server.scope && <span className="ml-auto shrink-0 text-[11px] text-faint">{server.scope}</span>}
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
                  <ServerRow key={server.name} server={server} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
