import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Panel, useReactFlow, useStore } from '@xyflow/react'
import { Brain, FolderPlus, Maximize, Plus, Settings, SquareDashed, ZoomIn, ZoomOut } from 'lucide-react'
import { useCanvasActions } from './CanvasContext'
import { FIT_OPTIONS, ZOOM_DURATION, useCanvasShortcuts } from './useCanvasShortcuts'

function Tooltip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-text shadow-lg group-hover:flex">
      {label}
      {shortcut && <kbd className="font-mono text-faint">{shortcut}</kbd>}
    </span>
  )
}

function NavButton({
  label,
  shortcut,
  onClick,
  active,
  primary,
  className = 'w-8',
  children
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  primary?: boolean
  className?: string
  children: ReactNode
}) {
  const tone = primary
    ? 'bg-text text-bg hover:opacity-85'
    : active
      ? 'bg-surface-2 text-text'
      : 'text-muted hover:bg-surface-2 hover:text-text'

  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`group relative flex h-8 items-center justify-center rounded-lg ${className} ${tone}`}
    >
      {children}
      {!active && <Tooltip label={label} shortcut={shortcut} />}
    </button>
  )
}

const Divider = () => <span className="mx-1.5 h-5 w-px bg-line" />

function NewBlockMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { addGroup, addFolder } = useCanvasActions()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const center = () => {
    const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    return { x: c.x - 160, y: c.y - 80 }
  }

  const items = [
    { label: 'Grupo', icon: SquareDashed, onClick: () => addGroup(center()) },
    { label: 'Nova pasta', icon: FolderPlus, onClick: () => addFolder(center()) }
  ]

  return (
    <div ref={ref} className="relative">
      <NavButton label="Novo bloco" onClick={() => setOpen((o) => !o)} active={open} primary>
        <Plus size={16} strokeWidth={2.5} />
      </NavButton>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-line bg-surface p-1 shadow-xl shadow-black/40">
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

export function NavBar({ zoomShortcuts = true }: { zoomShortcuts?: boolean }) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow()
  const zoom = useStore((s) => s.transform[2])
  const { openSettings, openMemory } = useCanvasActions()
  useCanvasShortcuts(zoomShortcuts)

  return (
    <Panel position="bottom-center" className="!mb-4">
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/40">
        <NewBlockMenu />

        <Divider />

        <NavButton label="Aumentar zoom" shortcut="⌘ +" onClick={() => zoomIn({ duration: ZOOM_DURATION })}>
          <ZoomIn size={16} />
        </NavButton>
        <NavButton
          label="Zoom em 100%"
          shortcut="⇧ 0"
          className="w-12"
          onClick={() => zoomTo(1, { duration: ZOOM_DURATION })}
        >
          <span className="font-mono text-xs">{Math.round(zoom * 100)}%</span>
        </NavButton>
        <NavButton label="Diminuir zoom" shortcut="⌘ −" onClick={() => zoomOut({ duration: ZOOM_DURATION })}>
          <ZoomOut size={16} />
        </NavButton>
        <NavButton label="Ver tudo" shortcut="⇧ 1" onClick={() => fitView(FIT_OPTIONS)}>
          <Maximize size={16} />
        </NavButton>

        <Divider />

        <NavButton label="Memória do Claude" onClick={openMemory}>
          <Brain size={16} />
        </NavButton>
        <NavButton label="Configurações" shortcut="⌘ ," onClick={openSettings}>
          <Settings size={16} />
        </NavButton>
      </div>
    </Panel>
  )
}
