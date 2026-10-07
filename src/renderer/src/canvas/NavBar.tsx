import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import {
  Bot,
  Brain,
  FolderPlus,
  MessageCirclePlus,
  Plus,
  Server,
  Settings,
  SquareDashed
} from 'lucide-react'
import { useDevServers } from '../devServers/useDevServers'
import { useCanvasActions } from './CanvasContext'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { useEscape } from '../useEscape'

const TOOLTIP_SIDE = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  // Alinhado à direita do botão, para não sair da janela no canto direito.
  'top-end': 'bottom-full right-0 mb-2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2'
}

// Também usado nos botões que flutuam acima da pasta (ProjectNode). Na barra lateral, abre à direita.
export function Tooltip({ label, shortcut, side = 'top' }: { label: string; shortcut?: string; side?: keyof typeof TOOLTIP_SIDE }) {
  return (
    <span
      className={`pointer-events-none absolute hidden items-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-text shadow-lg group-hover:flex ${TOOLTIP_SIDE[side]}`}
    >
      {label}
      {shortcut && <kbd className="font-mono text-faint">{shortcut}</kbd>}
    </span>
  )
}

// Também usado na barra de zoom (ViewBar). `selected` marca um botão ligado sem esconder o tooltip.
export function NavButton({
  label,
  shortcut,
  onClick,
  active,
  selected,
  primary,
  side = 'right',
  children
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  selected?: boolean
  primary?: boolean
  side?: keyof typeof TOOLTIP_SIDE
  children: ReactNode
}) {
  const tone = primary
    ? 'bg-text text-bg hover:opacity-85'
    : active || selected
      ? 'bg-surface-2 text-text'
      : 'text-muted hover:bg-surface-2 hover:text-text'

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`group relative flex size-8 items-center justify-center rounded-lg ${tone}`}
    >
      {children}
      {!active && <Tooltip label={label} shortcut={shortcut} side={side} />}
    </button>
  )
}

const Divider = () => <span className="my-1.5 h-px w-5 bg-line" />

function NewBlockMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { addGroup, addFolder, newLooseConversation } = useCanvasActions()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  useEscape(() => setOpen(false), open)

  const center = () => {
    const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return { x: c.x - 160, y: c.y - 80 }
  }

  const items = [
    { label: 'Grupo', icon: SquareDashed, onClick: () => addGroup(center()) },
    { label: 'Nova pasta', icon: FolderPlus, onClick: () => addFolder(center()) },
    { label: 'Nova conversa', icon: MessageCirclePlus, onClick: () => newLooseConversation() }
  ]

  return (
    <div ref={ref} className="relative">
      <NavButton label="Novo bloco" onClick={() => setOpen((o) => !o)} active={open} primary>
        <Plus size={16} strokeWidth={2.5} />
      </NavButton>
      {open && (
        <div className="absolute left-full top-0 ml-2 w-44 rounded-lg border border-line bg-surface p-1 shadow-xl shadow-black/40">
          {items.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              onClick={() => {
                onClick()
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2"
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// O selo mostra quantos servidores estão de pé; a lista abre num painel.
function DevServersButton({ onClick }: { onClick: () => void }) {
  const { servers } = useDevServers()
  return (
    <NavButton label="Servidores rodando" onClick={onClick}>
      <Server size={16} />
      {servers.length > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-running px-1 font-mono text-[9px] font-semibold text-bg">
          {servers.length}
        </span>
      )}
    </NavButton>
  )
}

export function NavBar({ zoomShortcuts = true }: { zoomShortcuts?: boolean }) {
  const { openSettings, openMemory, openAgents, openDevServers } = useCanvasActions()
  useCanvasShortcuts(zoomShortcuts)

  return (
    // Na lateral esquerda, no meio da altura: embaixo ela disputava espaço com o drawer aberto.
    <Panel position="center-left" className="!ml-4">
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/40">
        <NewBlockMenu />

        <Divider />

        <NavButton label="Agentes" onClick={openAgents}>
          <Bot size={16} />
        </NavButton>
        <DevServersButton onClick={openDevServers} />
        <NavButton label="Memória do Claude" onClick={() => openMemory()}>
          <Brain size={16} />
        </NavButton>

        <Divider />

        <NavButton label="Configurações" shortcut="⌘ ," onClick={openSettings}>
          <Settings size={16} />
        </NavButton>
      </div>
    </Panel>
  )
}
