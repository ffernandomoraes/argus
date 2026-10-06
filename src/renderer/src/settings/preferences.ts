import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type SessionSettings } from '../conversation/SessionSettings'

// Preferências do app, salvas neste computador. Valem em todas as janelas.
export type Preferences = {
  // Onde a conversa abre ao ser clicada no canvas.
  openIn: 'panel' | 'window'
  // Escala do conteúdo do drawer, ajustada com ⌘+ / ⌘- (ver useDrawerZoom).
  drawerZoom: number
  // Modelo, esforço, modo etc. de conversas que ainda não foram ajustadas no próprio chat.
  conversation: SessionSettings
}

const KEY = 'preferences'
const DEFAULTS: Preferences = { openIn: 'panel', drawerZoom: 1, conversation: DEFAULT_SETTINGS }

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Preferences>
    return { ...DEFAULTS, ...saved, conversation: { ...DEFAULT_SETTINGS, ...saved.conversation } }
  } catch {
    return DEFAULTS
  }
}

let current = read()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

// Mudança feita em outra janela (ex.: janela de conversa).
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  current = read()
  notify()
})

export function getPreferences(): Preferences {
  return current
}

export function setPreferences(patch: Partial<Preferences>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Sem armazenamento, vale só até fechar o app.
  }
  notify()
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current
  )
}
