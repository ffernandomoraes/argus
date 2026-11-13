import { useSyncExternalStore } from 'react'

// Rotas pela parte do endereço depois do # (a ponte só serve arquivos; o # nunca sai do aparelho).
// #/                     início
// #/folder/<pasta>       conversas de uma pasta
// #/chat/<pasta>/<id>    uma conversa (id: a sessão, ou "new-..." para uma nova)
// #/settings             ajustes
// #/usage                uso do Claude em detalhe
// #pair=<código>         pareamento vindo do QR code

export type Route =
  | { name: 'home' }
  | { name: 'folder'; path: string }
  | { name: 'chat'; cwd: string; id: string }
  | { name: 'settings' }
  | { name: 'usage' }
  | { name: 'pair'; code: string }

export function parseRoute(hash: string): Route {
  const pair = /^#pair=([^&]+)/.exec(hash)
  if (pair) return { name: 'pair', code: decodeURIComponent(pair[1]) }
  const parts = hash.replace(/^#\/?/, '').split('/').map((p) => {
    try {
      return decodeURIComponent(p)
    } catch {
      return p
    }
  })
  if (parts[0] === 'folder' && parts[1]) return { name: 'folder', path: parts[1] }
  if (parts[0] === 'chat' && parts[1] && parts[2]) return { name: 'chat', cwd: parts[1], id: parts[2] }
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'usage') return { name: 'usage' }
  return { name: 'home' }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'folder':
      return `#/folder/${encodeURIComponent(route.path)}`
    case 'chat':
      return `#/chat/${encodeURIComponent(route.cwd)}/${encodeURIComponent(route.id)}`
    case 'settings':
      return '#/settings'
    case 'usage':
      return '#/usage'
    case 'pair':
      return `#pair=${encodeURIComponent(route.code)}`
    default:
      return '#/'
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => location.hash)
}

// Profundidade dentro do app, guardada em cada passo do histórico: com ela, "voltar" sabe se há
// uma tela do app para trás (aberto por uma notificação, não há).
const depth = (): number => {
  const d = (history.state as { depth?: unknown } | null)?.depth
  return typeof d === 'number' ? d : 0
}

const changed = () => window.dispatchEvent(new HashChangeEvent('hashchange'))

export function go(route: Route): void {
  history.pushState({ depth: depth() + 1 }, '', routeHash(route))
  changed()
}

// Troca o endereço sem criar uma volta no histórico (conversa nova que ganhou a sessão).
export function replace(route: Route): void {
  history.replaceState({ depth: depth() }, '', routeHash(route))
  changed()
}

// Volta pelo histórico quando a tela veio de dentro do app; senão, para a tela de cima.
export function back(fallback: Route): void {
  if (depth() > 0) history.back()
  else replace(fallback)
}
