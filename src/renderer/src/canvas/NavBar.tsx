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
  SquareDashed,
  StickyNote
} from 'lucide-react'
import { useCanvasActions } from './CanvasContext'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { useEscape } from '../useEscape'
import { Presence } from '../motion'
import { IS_WIN, keys } from '../platform'
import { MENU_PANEL, MENU_ROW } from './ContextMenu'

const TOOLTIP_SIDE = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  // Alinhado à direita do botão, para não sair da janela no canto direito.
  'top-end': 'bottom-full right-0 mb-2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  // Na barra de título: abre para baixo, alinhado à direita do botão.
  'bottom-end': 'top-full right-0 mt-2'
}

// Também usado nos botões que flutuam acima da pasta (ProjectNode). Na barra lateral, abre à direita.
export function Tooltip({ label, shortcut, side = 'top' }: { label: string; shortcut?: string; side?: keyof typeof TOOLTIP_SIDE }) {
  return (
    <span
      className={`pointer-events-none absolute hidden items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-surface/90 px-2 py-1 text-[12px] text-text shadow-lg backdrop-blur-xl group-hover:flex ${TOOLTIP_SIDE[side]}`}
    >
      {label}
      {/* Escrito como no Mac ("⌘ ,"); no Windows aparece "Ctrl+,". */}
      {shortcut && <kbd className="font-mono text-faint">{keys(shortcut)}</kbd>}
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
  compact,
  side = 'right',
  children
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  selected?: boolean
  primary?: boolean
  // Versão menor, para barras discretas (ViewBar). A largura cresce com o conteúdo, como o "88%".
  compact?: boolean
  side?: keyof typeof TOOLTIP_SIDE
  children: ReactNode
}) {
  // O principal (Novo bloco) na cor de destaque, como o botão padrão do macOS.
  const tone = primary
    ? 'bg-accent text-white hover:brightness-110'
    : active || selected
      ? 'bg-fill text-text ring-1 ring-line ring-inset'
      : 'text-muted hover:bg-fill hover:text-text'

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`group relative flex items-center justify-center ${compact ? 'h-6 min-w-6 rounded-md' : 'size-8 rounded-md'} ${tone}`}
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
  const { addGroup, addFolder, addNote, newLooseConversation } = useCanvasActions()

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
    { label: 'Nova conversa', icon: MessageCirclePlus, onClick: () => newLooseConversation() },
    { label: 'Nota', icon: StickyNote, shortcut: 'C', onClick: () => addNote(center()) }
  ]

  return (
    <div ref={ref} className="relative">
      <NavButton label="Novo bloco" onClick={() => setOpen((o) => !o)} active={open} primary>
        <Plus size={16} strokeWidth={2.5} />
      </NavButton>
      <Presence kind="menu">
        {open && (
          <div className={`absolute left-full top-0 ml-2 w-44 ${MENU_PANEL}`}>
            {items.map(({ label, icon: Icon, shortcut, onClick }) => (
              <button
                key={label}
                onClick={() => {
                  onClick()
                  setOpen(false)
                }}
                className={`group ${MENU_ROW} text-text hover:bg-accent hover:text-white`}
              >
                <Icon size={14} />
                {label}
                {shortcut && <kbd className="ml-auto font-mono text-faint group-hover:text-white">{shortcut}</kbd>}
              </button>
            ))}
          </div>
        )}
      </Presence>
    </div>
  )
}

export function NavBar({ zoomShortcuts = true }: { zoomShortcuts?: boolean }) {
  const { openSettings, openMemory, openAgents, openDevServers } = useCanvasActions()
  useCanvasShortcuts(zoomShortcuts)

  return (
    // Na lateral esquerda, no meio da altura: embaixo ela disputava espaço com o drawer aberto.
    // Grupo de botões: raio do contêiner = raio do botão (md) + o respiro (p-1), para os cantos acompanharem.
    <Panel position="center-left" className="!ml-4">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface/90 p-1 shadow-xl shadow-black/40 backdrop-blur-xl">
        <NewBlockMenu />

        <Divider />

        <NavButton label="Agentes" onClick={openAgents}>
          <Bot size={16} />
        </NavButton>
        {/* No Windows não dá para saber quais servidores um agente abriu (ver devServers.ts). */}
        {!IS_WIN && (
          <NavButton label="Servidores rodando" onClick={openDevServers}>
            <Server size={16} />
          </NavButton>
        )}
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
