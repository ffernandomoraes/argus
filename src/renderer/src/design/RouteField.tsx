import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MENU_HOVER, MENU_PANEL, MENU_ROW } from '../canvas/ContextMenu'
import { useOutsideClick } from '../useOutsideClick'

export type RouteOption = { route: string; name?: string }

// Endereços conhecidos de cada projeto, enquanto o app está aberto: os abertos (à mão ou navegando
// na página), os links da página para outras páginas do mesmo servidor e as rotas lidas do código.
const visited = new Map<string, string[]>()
const linked = new Map<string, Set<string>>()
const scanned = new Map<string, { route: string; from: string }[]>()

// App do projeto que está na tela: num monorepo, o `dev` sobe vários (site, admin, app), um por
// porta. `dir` é a pasta dele dentro do projeto ('' na raiz ou quando não se sabe).
export type ProjectApp = { port: number; dir: string; name?: string; page?: boolean }
// Os apps que mostram página, para escolher qual abrir; a API e afins ficam de fora. Sem nenhum
// confirmado (ainda conferindo, ou o "/" de todos dá erro), todos.
export const pageApps = (apps: ProjectApp[]): ProjectApp[] => {
  const pages = apps.filter((a) => a.page)
  return pages.length ? pages : apps
}
export const appName = (app: ProjectApp): string => app.name ?? app.dir.split('/').filter(Boolean).pop() ?? ''
export const appLabel = (app: ProjectApp): string => (appName(app) ? `${appName(app)} - ${app.port}` : `localhost:${app.port}`)
// Abertos e links valem por app (a mesma rota em outro app é outra página).
export const routesKey = (projectPath: string, port?: number): string => `${projectPath}|${port ?? ''}`
let version = 0
const listeners = new Set<() => void>()
const changed = () => {
  version++
  listeners.forEach((l) => l())
}

// Só o caminho: ?busca e #ancora não fazem outra página.
const pathOnly = (route: string) => route.split(/[?#]/)[0] || '/'

// `key`: o de routesKey (projeto e porta do app).
export const rememberRoute = (key: string, route: string): void => {
  const projectPath = key
  const path = pathOnly(route)
  const list = visited.get(projectPath) ?? []
  if (list[0] === path) return
  visited.set(projectPath, [path, ...list.filter((r) => r !== path)].slice(0, 20))
  changed()
}

export const rememberLinks = (key: string, paths: string[]): void => {
  const projectPath = key
  const set = linked.get(projectPath) ?? new Set<string>()
  const before = set.size
  for (const p of paths.slice(0, 200)) set.add(pathOnly(p))
  linked.set(projectPath, set)
  if (set.size !== before) changed()
}

// Lista do campo: abertos primeiro (do mais recente), depois os links da página e as rotas do
// código (com o arquivo de onde vieram), sem repetir. As do código são relidas a cada abertura;
// com o app na tela conhecido, só as dos arquivos da pasta dele.
export function useKnownRoutes(projectPath: string, app?: ProjectApp): RouteOption[] {
  const key = routesKey(projectPath, app?.port)
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version
  )
  useEffect(() => {
    let alive = true
    void window.api.design.routes(projectPath).then((routes) => {
      if (!alive) return
      scanned.set(projectPath, routes)
      changed()
    })
    return () => {
      alive = false
    }
  }, [projectPath])
  const dir = app?.dir ? `${app.dir}/` : ''
  const all: RouteOption[] = [
    ...(visited.get(key) ?? []).map((route) => ({ route, name: 'aberta' })),
    ...[...(linked.get(key) ?? [])].map((route) => ({ route, name: 'link na página' })),
    ...(scanned.get(projectPath) ?? [])
      .filter((r) => !dir || r.from.startsWith(dir))
      .map((r) => ({ route: r.route, name: r.from.split('/').pop() }))
  ]
  return dedupe(all)
}

export function dedupe(options: RouteOption[]): RouteOption[] {
  const seen = new Set<string>()
  return options.filter((o) => !seen.has(o.route) && !!seen.add(o.route))
}

// "busca" ou "//busca" viram "/busca"; vazio é a raiz.
export const normalizeRoute = (text: string): string => `/${text.trim().replace(/^\/+/, '')}`

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
  const shown = options.filter((o) => !query || o.route.toLowerCase().includes(query) || o.name?.toLowerCase().includes(query))

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
