import { useSyncExternalStore } from 'react'

// O plano aberto na janela ao lado, para o cartão dele trocar "Abrir ao lado" por "Fechar". Quem
// abre e fecha é o estado dos drawers: o DrawerHost publica aqui o que está na tela.
let shown: string | null = null
let close: () => void = () => {}
const listeners = new Set<() => void>()

export function publishOpenPlan(text: string | null, onClose: () => void): void {
  close = onClose
  if (text === shown) return
  shown = text
  listeners.forEach((l) => l())
}

export const closeOpenPlan = (): void => close()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

// Texto do plano aberto ao lado (nulo: nenhum).
export const useOpenPlan = (): string | null => useSyncExternalStore(subscribe, () => shown)
