import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, type SessionSettings } from '../conversation/SessionSettings'

// Preferências do app, salvas neste computador. Valem em todas as janelas.
export type Preferences = {
  // Onde a conversa abre ao ser clicada no canvas. 'node' = bloco dentro do canvas, como o terminal.
  openIn: 'panel' | 'window' | 'node'
  // Escala do conteúdo do drawer, ajustada com ⌘+ / ⌘- (ver useDrawerZoom).
  drawerZoom: number
  // Modelo, esforço, modo etc. de cada conversa, até ser trocado no próprio chat (conversationSettings).
  conversation: SessionSettings
  // Boas-vindas vistas até o fim neste computador. Falso abre o passo a passo de novo.
  welcomeSeen: boolean
  // Versão dos padrões da conversa já aplicada. Até a 2, thinking vinha ligado e ficava salvo.
  conversationDefaults: number
}

const KEY = 'preferences'
const CONVERSATION_DEFAULTS = 2
const DEFAULTS: Preferences = {
  openIn: 'panel',
  drawerZoom: 1,
  conversation: DEFAULT_SETTINGS,
  welcomeSeen: false,
  conversationDefaults: CONVERSATION_DEFAULTS
}

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const saved = JSON.parse(raw) as Partial<Preferences>
    return {
      ...DEFAULTS,
      ...saved,
      // 'canvas' veio de uma versão de teste em que a conversa abria como nó no canvas; não volta
      // sozinho. A opção de hoje é 'node', escolhida de novo nas configurações.
      openIn: saved.openIn === 'window' || saved.openIn === 'node' ? saved.openIn : 'panel',
      // Preferência salva antes da versão 2 tinha thinking ligado sem a pessoa escolher: volta a
      // desligar uma vez, junto com o Ultracode.
      conversation:
        saved.conversationDefaults === CONVERSATION_DEFAULTS
          ? { ...DEFAULT_SETTINGS, ...saved.conversation }
          : { ...DEFAULT_SETTINGS, ...saved.conversation, thinking: false, ultracode: false },
      conversationDefaults: CONVERSATION_DEFAULTS
    }
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
