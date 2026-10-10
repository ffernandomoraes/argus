import { useEffect, useSyncExternalStore } from 'react'
import type { ProjectServer } from '../../../shared/devServers'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Servidor de cada pasta na tela. Uma consulta só para todas, a cada poucos segundos; mais
// rápido enquanto algum está subindo, para o botão trocar assim que a porta abrir. Com a janela
// oculta (minimizada, atrás de outra aba do sistema), não consulta: volta ao reaparecer.
const POLL = 5000
const FAST = 1000

const servers = createStore<ReadonlyMap<string, ProjectServer>>(new Map())
// Consultas que terminaram. Quem precisa esperar "duas consultas seguidas" acompanha daqui (a
// página do protótipo, quando a porta dela some de uma consulta).
const polls = createStore(0)
const watching = new Map<string, number>()
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
// Pedido de conferência no meio de outra: roda de novo logo depois, em vez de duas juntas.
let again = false

// Só o que mudou vira um Map novo: a pasta que não mudou continua com o mesmo objeto (sem redesenho).
function merge(current: ReadonlyMap<string, ProjectServer>, status: Record<string, ProjectServer>) {
  let next: Map<string, ProjectServer> | null = null
  for (const [path, server] of Object.entries(status)) {
    // A pasta pode ter saído da tela enquanto a consulta rodava.
    if (!watching.has(path) || JSON.stringify(server) === JSON.stringify(current.get(path))) continue
    next ??= new Map(current)
    next.set(path, server)
  }
  return next ?? current
}

async function refresh(): Promise<void> {
  if (running) {
    again = true
    return
  }
  running = true
  if (timer) clearTimeout(timer)
  timer = null
  try {
    const status = await window.api.projectServers.status([...watching.keys()])
    // Antes do estado novo: quem vê a porta sumir já lê o número desta consulta.
    polls.set((n) => n + 1)
    servers.set((current) => merge(current, status))
  } catch {
    // Tenta de novo na próxima volta.
  }
  running = false
  if (again) {
    again = false
    return refresh()
  }
  schedule()
}

function schedule(): void {
  if (watching.size === 0 || document.hidden) return
  // Também enquanto confere quais portas mostram página (modo design).
  const starting = [...servers.get().values()].some((s) => s.state === 'starting' || s.apps?.some((a) => a.page === undefined))
  timer = setTimeout(() => void refresh(), starting ? FAST : POLL)
}

window.addEventListener('focus', () => watching.size > 0 && void refresh())
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && watching.size > 0) void refresh()
})

function watch(path: string): () => void {
  watching.set(path, (watching.get(path) ?? 0) + 1)
  if (!servers.get().has(path)) void refresh()
  return () => {
    const n = (watching.get(path) ?? 1) - 1
    if (n > 0) return void watching.set(path, n)
    watching.delete(path)
    servers.set((current) => {
      if (!current.has(path)) return current
      const next = new Map(current)
      next.delete(path)
      return next
    })
  }
}

// Nulo antes da primeira consulta.
export function useProjectServer(path: string): ProjectServer | null {
  useEffect(() => watch(path), [path])
  return useStore(servers, (m) => m.get(path) ?? null)
}

const idle = () => () => {}

// Número de consultas já feitas. `enabled` falso: não acompanha (não redesenha a cada consulta) e
// devolve o número da hora da leitura.
export function useServerPolls(enabled: boolean): number {
  return useSyncExternalStore(enabled ? polls.subscribe : idle, polls.get)
}

// noBrowser: sem abrir o navegador sozinho (modo design: a página fica no drawer).
export async function startProjectServer(path: string, noBrowser = false): Promise<void> {
  await window.api.projectServers.start(path, noBrowser)
  await refresh()
}

export async function stopProjectServer(path: string): Promise<void> {
  await window.api.projectServers.stop(path)
  await refresh()
}
