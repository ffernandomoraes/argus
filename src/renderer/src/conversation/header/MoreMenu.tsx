import { useRef, useState } from 'react'
import { Ellipsis, type LucideIcon } from 'lucide-react'
import { Presence } from '../../motion'
import { MENU_PANEL, MENU_ROW } from '../../ui/menuStyles'
import { useEscape } from '../../useEscape'
import { useOutsideClick } from '../../useOutsideClick'
import { HeaderButton } from './HeaderButton'

export type MoreMenuItem = { label: string; icon: LucideIcon; onClick: () => void }

// O que não é fechar nem código fica num menu só: o cabeçalho com um botão por opção pesava.
export function MoreMenu({ items }: { items: MoreMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  // Empilhado depois do fechar do drawer: com o menu aberto, o ESC fecha só ele.
  useEscape(() => setOpen(false), open)
  return (
    <div ref={ref} className="relative">
      <HeaderButton label="Mais opções" onClick={() => setOpen((o) => !o)} active={open}>
        <Ellipsis size={15} />
      </HeaderButton>
      <Presence kind="menu">
        {open && (
          // Clique na borda do menu não arrasta o drawer (o cabeçalho é a alça).
          <div onPointerDown={(e) => e.stopPropagation()} className={`absolute right-0 top-full z-50 mt-1 w-52 ${MENU_PANEL}`}>
            {items.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={() => {
                  setOpen(false)
                  onClick()
                }}
                className={`${MENU_ROW} text-text hover:bg-accent hover:text-white`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        )}
      </Presence>
    </div>
  )
}
