import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Loader2, Lock, Play, Power } from 'lucide-react'
import { ContextMenu, type MenuItem } from '../canvas/ContextMenu'
import { Tooltip } from '../canvas/NavBar'
import { startProjectServer, stopProjectServer, useProjectServer } from './projectServers'

const appNameOf = (app?: { name?: string }) => (app?.name ? `${app.name} - ` : '')

const BUTTON =
  'group relative flex h-6 min-w-6 items-center justify-center gap-1.5 rounded-md border border-line bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-text'

// Botão acima da pasta: parado, inicia o script de dev (ou start) em segundo plano; subindo ou
// rodando, abre um menu para abrir no navegador ou encerrar. Rodando também quando o comando
// veio de outro lugar (um terminal, o Claude Code).
export function ProjectServerButton({ path }: { path: string }) {
  const server = useProjectServer(path)
  const [busy, setBusy] = useState<'starting' | 'stopping' | null>(null)
  // Onde o menu abre; os itens saem do estado atual, para acompanhar a porta que abriu depois.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  // Sem script para rodar, o botão só aparece se já houver algo de pé na pasta.
  if (!server || (server.state === 'stopped' && !server.script)) return null

  const act = async (kind: 'starting' | 'stopping') => {
    setBusy(kind)
    await (kind === 'starting' ? startProjectServer(path) : stopProjectServer(path))
    setBusy(null)
  }

  const stopItem: MenuItem = server.locked
    ? { type: 'action', label: 'Aberto por uma sessão do Claude Code: encerrar derrubaria a sessão', icon: Lock, disabled: true, onSelect: () => {} }
    : { type: 'action', label: 'Encerrar servidor', icon: Power, danger: true, onSelect: () => void act('stopping') }
  const items: MenuItem[] = [
    ...server.ports.map(
      (port): MenuItem => ({
        type: 'action',
        // Com o nome do pacote: num monorepo, cada porta é um app (site, admin, api).
        label: `Abrir ${appNameOf(server.apps?.find((a) => a.port === port))}localhost:${port}`,
        icon: ExternalLink,
        onSelect: () => window.open(`http://localhost:${port}`)
      })
    ),
    ...(server.ports.length > 0 ? [{ type: 'separator' } as const] : []),
    stopItem
  ]

  const toggleMenu = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setMenu((m) => (m ? null : { x: rect.left, y: rect.bottom + 4 }))
  }

  const stopped = server.state === 'stopped' && !busy
  const pending = busy !== null || server.state === 'starting'

  let label: string
  if (busy === 'stopping') label = 'Encerrando servidor'
  else if (pending) label = `Iniciando servidor - ${server.command}`
  else if (stopped) label = `Iniciar servidor - ${server.command}`
  else label = 'Servidor rodando'

  return (
    <>
      <button
        ref={ref}
        aria-label={label}
        disabled={busy === 'stopping'}
        // Com o menu aberto, o clique no botão só fecha: sem isso o menu fecharia no
        // mousedown e reabriria no click.
        onMouseDown={(e) => menu && e.stopPropagation()}
        onClick={() => (stopped ? void act('starting') : toggleMenu())}
        className={`${BUTTON} ${server.state === 'running' && !busy ? 'px-2' : ''} ${stopped && server.error ? 'text-red-400' : ''}`}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : stopped ? (
          <Play size={12} />
        ) : (
          <>
            <span className="size-1.5 rounded-full" style={{ background: 'var(--color-done)' }} />
            {server.ports[0] && <span className="font-mono text-[12px]">:{server.ports[0]}</span>}
          </>
        )}
        {stopped && server.error ? (
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-72 -translate-x-1/2 flex-col gap-1 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-left text-[12px] text-text shadow-lg group-hover:flex">
            O servidor parou com erro - clique para tentar de novo
            <span className="break-words font-mono text-faint">{server.error}</span>
          </span>
        ) : (
          !menu && <Tooltip label={label} />
        )}
      </button>
      {/* No body: dentro do canvas o `fixed` seguiria o zoom e o deslocamento dele. */}
      {menu && createPortal(<ContextMenu menu={{ ...menu, items }} onClose={() => setMenu(null)} />, document.body)}
    </>
  )
}
