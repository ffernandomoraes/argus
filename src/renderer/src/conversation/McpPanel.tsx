import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Lock, Power, RefreshCw, X } from 'lucide-react'
import type { McpServer, McpStatus } from '../../../shared/mcp'
import { useEscape } from '../useEscape'

// Como cada estado aparece. A ordem aqui é a ordem das seções no painel.
const GROUPS = [
  { status: 'connected', label: 'Conectados', icon: Check, tone: 'text-emerald-400' },
  { status: 'needs-auth', label: 'Precisam de autorização', icon: Lock, tone: 'text-needs-you' },
  { status: 'failed', label: 'Com erro', icon: AlertTriangle, tone: 'text-red-400' },
  { status: 'pending', label: 'Conectando', icon: Loader2, tone: 'text-running' },
  { status: 'disabled', label: 'Desligados', icon: Power, tone: 'text-faint' }
] as const

const HINT: Partial<Record<McpServer['status'], string>> = {
  'needs-auth': 'Autorize em uma conversa do Claude Code com o comando /mcp, ou nas configurações do serviço.',
  failed: 'O Claude não conseguiu conectar. Veja o erro de cada um abaixo.'
}

function ServerRow({ server }: { server: McpServer }) {
  return (
    <li className="rounded-md px-2 py-1.5 hover:bg-surface-2">
      <div className="flex items-center gap-2">
        <span className="truncate text-xs text-text">{server.name}</span>
        {server.tools > 0 && (
          <span className="shrink-0 text-[10px] text-faint">
            {server.tools} {server.tools === 1 ? 'ferramenta' : 'ferramentas'}
          </span>
        )}
        {server.scope && <span className="ml-auto shrink-0 text-[10px] text-faint">{server.scope}</span>}
      </div>
      {server.error && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted">{server.error}</p>}
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

  const load = useCallback(() => {
    setLoading(true)
    window.api.chat.mcpStatus(conversationKey, cwd, account).then((s) => {
      setStatus(s)
      setLoading(false)
    })
  }, [conversationKey, cwd, account])

  useEffect(load, [load])

  useEscape(onClose)

  const servers = status?.ok ? status.servers : []

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Servidores MCP"
        className="flex h-[min(560px,100%)] w-[min(520px,100%)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Servidores MCP</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{cwd}</div>
          </div>
          <button
            aria-label="Atualizar"
            title="Atualizar"
            onClick={load}
            disabled={loading}
            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            aria-label="Fechar"
            title="Fechar"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading && servers.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-8 text-xs text-faint">
              <Loader2 size={13} className="animate-spin" />
              Perguntando aos servidores…
            </p>
          )}
          {status && !status.ok && <p className="px-2 py-4 text-xs text-red-400">{status.error}</p>}
          {status?.ok && servers.length === 0 && !loading && (
            <p className="px-2 py-4 text-xs text-faint">Nenhum servidor MCP configurado para esta pasta.</p>
          )}
          {GROUPS.map(({ status: s, label, icon: Icon, tone }) => {
            const list = servers.filter((x) => x.status === s)
            if (!list.length) return null
            return (
              <section key={s} className="mb-4 last:mb-0">
                <div className="mb-1 flex items-center gap-2 px-2">
                  <Icon size={12} className={`shrink-0 ${tone} ${s === 'pending' ? 'animate-spin' : ''}`} />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
                  <span className="text-[11px] text-faint">{list.length}</span>
                </div>
                {HINT[s] && <p className="mb-1 px-2 text-[11px] leading-snug text-faint">{HINT[s]}</p>}
                <ul className="flex flex-col">
                  {list.map((server) => (
                    <ServerRow key={server.name} server={server} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
