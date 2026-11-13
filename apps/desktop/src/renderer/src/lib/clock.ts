import { useSyncExternalStore } from 'react'
import type { ReadableStore } from './createStore'

// Relógio compartilhado da janela: um timer só por intervalo, ligado quando o primeiro componente
// passa a olhar e desligado quando o último sai. Todos que usam o mesmo intervalo recebem a mesma
// hora (a do último tique) e mudam juntos: 40 itens com "há 5min" são um timer, não 40.

// Abaixo disso o relógio viraria animação (para isso, requestAnimationFrame).
const MIN_INTERVAL = 100

const clocks = new Map<number, ReadableStore<number>>()

// O relógio do intervalo, para ler fora do React (`getClock(60_000).get()`) ou nos testes.
export function getClock(intervalMs: number): ReadableStore<number> {
  const ms = Math.max(MIN_INTERVAL, Math.round(intervalMs) || 0)
  let clock = clocks.get(ms)
  if (!clock) {
    clock = createClock(ms)
    clocks.set(ms, clock)
  }
  return clock
}

// Hora atual (Date.now()) que se atualiza a cada `intervalMs`. `enabled` falso para de acompanhar
// (ex.: painel fechado) e fica com a última hora lida.
export function useNow(intervalMs: number, enabled = true): number {
  const clock = getClock(intervalMs)
  return useSyncExternalStore(enabled ? clock.subscribe : idle, clock.get)
}

const idle = () => () => {}

function createClock(ms: number): ReadableStore<number> {
  let now = Date.now()
  let timeout: ReturnType<typeof setTimeout> | null = null
  let interval: ReturnType<typeof setInterval> | null = null
  const listeners = new Set<() => void>()
  const running = () => timeout !== null || interval !== null

  const tick = () => {
    now = Date.now()
    for (const listener of [...listeners]) listener()
  }
  // Continua de onde o último tique parou: quem chega logo depois de o relógio desligar não espera
  // um intervalo inteiro a mais pela próxima hora.
  const start = () => {
    timeout = setTimeout(
      () => {
        timeout = null
        interval = setInterval(tick, ms)
        tick()
      },
      Math.max(0, now + ms - Date.now())
    )
  }
  const stop = () => {
    if (timeout !== null) clearTimeout(timeout)
    if (interval !== null) clearInterval(interval)
    timeout = null
    interval = null
  }

  return {
    get: () => {
      // Parado há mais de um intervalo: pega a hora de agora, para a tela não nascer mostrando a
      // hora velha. A leitura seguinte já devolve o mesmo valor (o React confere isso).
      if (!running() && Date.now() - now >= ms) now = Date.now()
      return now
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (!running()) start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stop()
      }
    }
  }
}
