import { useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { FolderPlus, MessageCirclePlus, Plus, SquareDashed, StickyNote } from 'lucide-react'
import { Presence } from '../../motion'
import { MENU_PANEL, MENU_ROW } from '../../ui/menuStyles'
import { NavButton } from '../../ui/NavButton'
import { useEscape } from '../../useEscape'
import { useOutsideClick } from '../../useOutsideClick'
import { useCanvasActions } from '../CanvasContext'

// "Novo bloco" da barra lateral: grupo, pasta, conversa sem projeto ou nota, no meio da tela.
export function NewBlockMenu() {
  const [open, setOpen] = useState(false)
  // Botão e menu num elemento só: o clique no botão não conta como fora.
  const ref = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const { addGroup, addFolder, addNote, newLooseConversation } = useCanvasActions()

  useOutsideClick(ref, () => setOpen(false), open)
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
