import { useEffect, useSyncExternalStore } from 'react'
import type { ProjectServer } from '../../../shared/devServers'

// Servidor de cada pasta na tela. Uma consulta só para todas, a cada poucos segundos; mais
// rápido enquanto algum está subindo, para o botão trocar assim que a porta abrir.
const POLL = 5000
const FAST = 1000

const byPath = new Map<string, ProjectServer>()
const watching = new Map<string, number>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let running = false
// Pedido de conferência no meio de outra: roda de novo logo depois, em vez de duas juntas.
let again = false

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
    let changed = false
    for (const [path, server] of Object.entries(status)) {
      // A pasta pode ter saído da tela enquanto a consulta rodava.
      if (!watching.has(path) || JSON.stringify(server) === JSON.stringify(byPath.get(path))) continue
      byPath.set(path, server)
      changed = true
    }
    if (changed) listeners.forEach((l) => l())
  } catch {
    // Tenta de novo na próxima volta.
  }
  running = false
  if (again) {
    again = false
    return refresh()
  }
  if (watching.size === 0) return
  const starting = [...byPath.values()].some((s) => s.state === 'starting')
  timer = setTimeout(refresh, starting ? FAST : POLL)
}

window.addEventListener('focus', () => watching.size > 0 && void refresh())

function watch(path: string): () => void {
  watching.set(path, (watching.get(path) ?? 0) + 1)
  if (!byPath.has(path)) void refresh()
  return () => {
    const n = (watching.get(path) ?? 1) - 1
    if (n > 0) return void watching.set(path, n)
    watching.delete(path)
    byPath.delete(path)
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Nulo antes da primeira consulta.
export function useProjectServer(path: string): ProjectServer | null {
  useEffect(() => watch(path), [path])
  return useSyncExternalStore(subscribe, () => byPath.get(path) ?? null)
}

export async function startProjectServer(path: string): Promise<void> {
  await window.api.projectServers.start(path)
  await refresh()
}

export async function stopProjectServer(path: string): Promise<void> {
  await window.api.projectServers.stop(path)
  await refresh()
}
