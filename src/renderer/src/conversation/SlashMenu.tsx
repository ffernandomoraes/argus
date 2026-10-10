import { MENU_ACTIVE } from '../ui/menuStyles'
import { POPOVER } from './popover'
import type { SlashCommand } from './slashCommands'

// Lista dos comandos de barra acima do campo, enquanto o texto é "/" + palavra.
export function SlashMenu({
  items,
  active,
  onHover,
  onSelect
}: {
  items: SlashCommand[]
  active: number
  onHover: (index: number) => void
  onSelect: (command: SlashCommand) => void
}) {
  return (
    <div className={`absolute bottom-full left-0 right-0 z-10 mb-2 ${POPOVER}`}>
      {items.map((c, i) => (
        <button
          key={c.name}
          // mousedown: escolher sem tirar o foco do campo de texto
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(c)
          }}
          onMouseEnter={() => onHover(i)}
          className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left ${i === active ? MENU_ACTIVE : ''}`}
        >
          <span className="w-28 shrink-0 font-mono text-xs text-text">/{c.name}</span>
          <span className="truncate text-[12px] text-faint">{c.description}</span>
        </button>
      ))}
    </div>
  )
}
