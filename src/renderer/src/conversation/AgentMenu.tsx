import { Bot, FolderOpen } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { MENU_ACTIVE } from '../ui/menuStyles'
import { POPOVER } from './popover'

// Lista dos agentes acima do campo, enquanto o texto termina em "@" + palavra.
export function AgentMenu({
  items,
  active,
  onHover,
  onSelect
}: {
  items: AgentDef[]
  active: number
  onHover: (index: number) => void
  onSelect: (agent: AgentDef) => void
}) {
  return (
    <div className={`absolute bottom-full left-0 right-0 z-10 mb-2 ${POPOVER}`}>
      {items.map((a, i) => (
        <button
          key={a.path}
          // mousedown: escolher sem tirar o foco do campo de texto
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(a)
          }}
          onMouseEnter={() => onHover(i)}
          className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left ${i === active ? MENU_ACTIVE : ''}`}
        >
          <span className="flex w-40 shrink-0 items-center gap-1.5 self-center text-xs text-text">
            <Bot size={12} className="shrink-0 text-muted" />
            <span className="truncate">@{a.name}</span>
            {a.scope === 'project' && (
              <FolderOpen size={11} className="shrink-0 text-faint" aria-label="Agente deste projeto" />
            )}
          </span>
          <span className="truncate text-[12px] text-faint">{a.description}</span>
        </button>
      ))}
    </div>
  )
}
