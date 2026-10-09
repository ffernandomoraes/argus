import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { COLORS } from './factory'
import { useEscape } from '../useEscape'
import { useOutsideClick } from '../useOutsideClick'

type Icon = ComponentType<{ size?: number }>

export type MenuItem =
  // checked: a opção que está valendo numa lista de escolha (ex.: a conta do grupo).
  | { type: 'action'; label: string; icon?: Icon; onSelect: () => void; danger?: boolean; disabled?: boolean; checked?: boolean }
  | { type: 'submenu'; label: string; icon?: Icon; items: MenuItem[] }
  | { type: 'colors'; label: string; value: string; onSelect: (color: string) => void }
  | { type: 'separator' }

export type MenuState = { x: number; y: number; items: MenuItem[] }

// Como os menus do macOS: fundo levemente translúcido e o item sob o mouse na cor de destaque.
export const MENU_PANEL = 'rounded-xl border border-line bg-surface/90 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl'
export const MENU_ROW = 'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs'
// Item de lista rica (com descrição e ícones) sob o mouse ou escolhido pelo teclado: tudo dentro
// fica branco sobre a cor de destaque.
export const MENU_HOVER = 'hover:bg-accent hover:text-white [&:hover_span]:text-white [&:hover_svg]:text-white'
export const MENU_ACTIVE = 'bg-accent text-white [&_span]:text-white [&_svg]:text-white'
const PANEL = `min-w-48 ${MENU_PANEL}`
const ROW = MENU_ROW

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <>
      {items.map((item, i) => {
        if (item.type === 'separator') return <div key={i} className="my-1 h-px bg-line" />

        if (item.type === 'colors') {
          return (
            <div key={i} className="px-2 py-1.5">
              <div role="group" aria-label={item.label} className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    onClick={() => {
                      item.onSelect(c)
                      onClose()
                    }}
                    className={`size-4 rounded-full ${item.value === c ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          )
        }

        const Icon = item.icon

        if (item.type === 'submenu') {
          return (
            <div key={i} className="group/sub relative">
              <div className={`${ROW} text-text group-hover/sub:bg-accent group-hover/sub:text-white`}>
                {Icon && <Icon size={14} />}
                {item.label}
                <ChevronRight size={14} className="ml-auto text-faint group-hover/sub:text-white" />
              </div>
              <div className="absolute left-full top-0 hidden pl-1 group-hover/sub:block">
                <div className={PANEL}>
                  <MenuList items={item.items} onClose={onClose} />
                </div>
              </div>
            </div>
          )
        }

        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={`group/item ${ROW} ${
              item.danger ? 'text-red-400 hover:bg-red-500 hover:text-white' : 'text-text hover:bg-accent hover:text-white'
            } disabled:text-faint disabled:hover:bg-transparent`}
          >
            {Icon && <Icon size={14} />}
            {item.label}
            {item.checked && <Check size={14} className="ml-auto shrink-0 text-muted group-hover/item:text-white" />}
          </button>
        )
      })}
    </>
  )
}

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })

  // Mantém o menu dentro da janela quando o clique é perto da borda.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, window.innerWidth - width - 8),
      y: Math.min(menu.y, window.innerHeight - height - 8)
    })
  }, [menu])

  useOutsideClick(ref, onClose)
  useEffect(() => {
    window.addEventListener('wheel', onClose)
    return () => window.removeEventListener('wheel', onClose)
  }, [onClose])
  useEscape(onClose)

  return (
    <div
      ref={ref}
      className={`fixed z-50 ${PANEL}`}
      style={{ left: pos.x, top: pos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList items={menu.items} onClose={onClose} />
    </div>
  )
}
