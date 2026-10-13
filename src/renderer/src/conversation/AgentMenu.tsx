import { Bot, FolderOpen } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { MENU_ACTIVE } from '../ui/menuStyles'
import { POPOVER } from './popover'
import { tr } from '../i18n'

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
    // Grade com subgrid, como o SlashMenu: a coluna do nome cresce até o maior nome
    // (sem cortar "@vercel:performance-optimizer"); só um nome enorme é truncado.
    <div
      className={`absolute bottom-full left-0 right-0 z-10 mb-2 grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] ${POPOVER}`}
    >
      {items.map((a, i) => (
        <button
          key={a.path}
          // mousedown: escolher sem tirar o foco do campo de texto
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(a)
          }}
          onMouseEnter={() => onHover(i)}
          className={`col-span-2 grid grid-cols-subgrid items-baseline gap-x-3 rounded-md px-2 py-1.5 text-left ${i === active ? MENU_ACTIVE : ''}`}
        >
          <span className="flex min-w-0 items-center gap-1.5 self-center whitespace-nowrap text-xs text-text">
            <Bot size={12} className="shrink-0 text-muted" />
            <span className="truncate">@{a.name}</span>
            {a.scope === 'project' && (
              <FolderOpen size={11} className="shrink-0 text-faint" aria-label={tr('Agente deste projeto', 'Agent from this project')} />
            )}
          </span>
          <span className="truncate text-[12px] text-faint">{a.description}</span>
        </button>
      ))}
    </div>
  )
}
