import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { COLORS } from './factory'
import { useEscape } from '../useEscape'
import { MENU_PANEL, MENU_ROW } from '../ui/menuStyles'
import { useOutsideClick } from '../useOutsideClick'

type Icon = ComponentType<{ size?: number }>

export type MenuItem =
  // checked: a opção que está valendo numa lista de escolha (ex.: a conta do grupo).
  | { type: 'action'; label: string; icon?: Icon; onSelect: () => void; danger?: boolean; disabled?: boolean; checked?: boolean }
  | { type: 'submenu'; label: string; icon?: Icon; items: MenuItem[] }
  | { type: 'colors'; label: string; value: string; onSelect: (color: string) => void }
  | { type: 'separator' }

export type MenuState = { x: number; y: number; items: MenuItem[] }

const PANEL = `min-w-48 ${MENU_PANEL}`
const ROW = MENU_ROW

// Folga até a borda da janela.
const EDGE = 8

// Submenu: abre ao lado do item, à direita; sem espaço até a borda da janela, à esquerda. Perto
// do pé da janela, sobe o quanto faltar. Medido ao abrir, antes de aparecer na tela.
function Submenu({ item, onClose }: { item: Extract<MenuItem, { type: 'submenu' }>; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState({ left: false, up: 0 })
  const panel = useRef<HTMLDivElement>(null)
  const Icon = item.icon

  useLayoutEffect(() => {
    const el = panel.current
    const row = el?.parentElement
    if (!open || !el || !row) return
    const anchor = row.getBoundingClientRect()
    const { width, height } = el.getBoundingClientRect()
    const spaceRight = window.innerWidth - EDGE - anchor.right
    const spaceLeft = anchor.left - EDGE
    setPlace({
      left: width > spaceRight && spaceLeft > spaceRight,
      up: Math.max(0, Math.min(anchor.top + height - (window.innerHeight - EDGE), anchor.top - EDGE))
    })
  }, [open])

  return (
    <div className="group/sub relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className={`${ROW} text-text group-hover/sub:bg-accent group-hover/sub:text-white`}>
        {Icon && <Icon size={14} />}
        {item.label}
        <ChevronRight size={14} className="ml-auto text-faint group-hover/sub:text-white" />
      </div>
      {open && (
        <div
          ref={panel}
          className={`absolute ${place.left ? 'right-full pr-1' : 'left-full pl-1'}`}
          style={{ top: -place.up }}
        >
          <div className={PANEL}>
            <MenuList items={item.items} onClose={onClose} />
          </div>
        </div>
      )}
    </div>
  )
}

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

        if (item.type === 'submenu') return <Submenu key={i} item={item} onClose={onClose} />

        const Icon = item.icon
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
      x: Math.min(menu.x, window.innerWidth - width - EDGE),
      y: Math.min(menu.y, window.innerHeight - height - EDGE)
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
