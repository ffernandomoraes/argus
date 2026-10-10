import { useEffect, useMemo } from 'react'
import type { DesignRoute } from '../../../../shared/ipc'
import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import type { ProjectApp } from './projectApps'
import { pathOnly } from './routeText'

export type RouteOption = { route: string; name?: string }

// Endereços conhecidos de cada projeto, enquanto o app está aberto: os abertos (à mão ou navegando
// na página), os links da página para outras páginas do mesmo servidor e as rotas lidas do código.
// Abertos e links valem por app (chave de routesKey); as do código, pela pasta do projeto.
type Known = {
  visited: ReadonlyMap<string, readonly string[]>
  linked: ReadonlyMap<string, ReadonlySet<string>>
  scanned: ReadonlyMap<string, readonly DesignRoute[]>
}

const known = createStore<Known>({ visited: new Map(), linked: new Map(), scanned: new Map() })

// Abertos e links valem por app (a mesma rota em outro app é outra página).
export const routesKey = (projectPath: string, port?: number): string => `${projectPath}|${port ?? ''}`

// `key`: o de routesKey (projeto e porta do app).
export function rememberRoute(key: string, route: string): void {
  const path = pathOnly(route)
  known.set((k) => {
    const list = k.visited.get(key) ?? []
    if (list[0] === path) return k
    const next = [path, ...list.filter((r) => r !== path)].slice(0, 20)
    return { ...k, visited: new Map(k.visited).set(key, next) }
  })
}

export function rememberLinks(key: string, paths: readonly string[]): void {
  known.set((k) => {
    const before = k.linked.get(key) ?? new Set<string>()
    const set = new Set(before)
    for (const p of paths.slice(0, 200)) set.add(pathOnly(p))
    return set.size === before.size ? k : { ...k, linked: new Map(k.linked).set(key, set) }
  })
}

export function dedupe(options: RouteOption[]): RouteOption[] {
  const seen = new Set<string>()
  return options.filter((o) => !seen.has(o.route) && !!seen.add(o.route))
}

// Lista do campo: abertos primeiro (do mais recente), depois os links da página e as rotas do
// código (com o arquivo de onde vieram), sem repetir. Com o app na tela conhecido (`dir` com a
// barra no fim), só as rotas dos arquivos da pasta dele.
function knownOptions(k: Known, key: string, projectPath: string, dir: string): RouteOption[] {
  return dedupe([
    ...(k.visited.get(key) ?? []).map((route) => ({ route, name: 'aberta' })),
    ...[...(k.linked.get(key) ?? [])].map((route) => ({ route, name: 'link na página' })),
    ...(k.scanned.get(projectPath) ?? [])
      .filter((r) => !dir || r.from.startsWith(dir))
      .map((r) => ({ route: r.route, name: r.from.split('/').pop() }))
  ])
}

// As rotas do código são relidas a cada abertura.
export function useKnownRoutes(projectPath: string, app?: ProjectApp): RouteOption[] {
  const key = routesKey(projectPath, app?.port)
  const dir = app?.dir ? `${app.dir}/` : ''
  const state = useStore(known)
  useEffect(() => {
    let alive = true
    window.api.design.routes(projectPath).then(
      (routes) => alive && known.set((k) => ({ ...k, scanned: new Map(k.scanned).set(projectPath, routes) })),
      // Sem as rotas do código, a lista fica com as outras.
      (err: unknown) => console.error('[design] rotas do projeto:', err)
    )
    return () => {
      alive = false
    }
  }, [projectPath])
  return useMemo(() => knownOptions(state, key, projectPath, dir), [state, key, projectPath, dir])
}
