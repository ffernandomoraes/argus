import { useRef, useState } from 'react'
import { MENU_HOVER, MENU_PANEL, MENU_ROW } from '../../ui/menuStyles'
import { useOutsideClick } from '../../useOutsideClick'
import type { RouteOption } from './knownRoutes'
import { normalizeRoute } from './routeText'

// No máximo isto na lista: uma página com centenas de links pesava a cada tecla digitada.
const MAX_SHOWN = 100

// Campo de endereço do protótipo com a lista dos endereços conhecidos, filtrada pelo que se digita.
// Setas escolhem, Enter abre (o escolhido, ou o que foi digitado), Esc fecha a lista.
export function RouteField({
  value,
  onChange,
  onGo,
  options
}: {
  value: string
  onChange: (value: string) => void
  onGo: (route: string) => void
  options: RouteOption[]
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Aberta com clique, a lista mostra tudo (o campo já tem o endereço atual); filtra ao digitar.
  const [typed, setTyped] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  const query = typed ? value.trim().replace(/^\/+/, '').toLowerCase() : ''
  const shown = options
    .filter((o) => !query || o.route.toLowerCase().includes(query) || o.name?.toLowerCase().includes(query))
    .slice(0, MAX_SHOWN)

  const go = (route: string) => {
    setOpen(false)
    setActive(-1)
    onGo(normalizeRoute(route))
  }

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setTyped(true)
          setActive(-1)
        }}
        onFocus={() => {
          setOpen(true)
          setTyped(false)
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
            if (!shown.length) return
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((a) => (a + step + shown.length) % shown.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(open && shown[active] ? shown[active].route : value)
          } else if (e.key === 'Escape' && open) {
            // A lista fecha sem fechar o drawer.
            e.preventDefault()
            setOpen(false)
          }
        }}
        placeholder="/endereço-da-tela"
        spellCheck={false}
        className="h-6 w-full rounded-md bg-fill px-2 font-mono text-[12px] outline-none placeholder:text-faint"
      />
      {open && shown.length > 0 && (
        <div className={`absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto ${MENU_PANEL}`}>
          {shown.map((o, i) => (
            <button
              key={o.route}
              // Sem tirar o foco do campo.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(o.route)}
              onMouseEnter={() => setActive(i)}
              className={`${MENU_ROW} ${i === active ? 'bg-accent text-white [&_span]:text-white' : MENU_HOVER}`}
            >
              <span className="truncate font-mono">{o.route}</span>
              {o.name && <span className="ml-auto shrink-0 truncate pl-3 text-faint">{o.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
