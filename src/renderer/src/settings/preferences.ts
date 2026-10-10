import { DEFAULT_SETTINGS, type SessionSettings } from '../conversation/SessionSettings'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

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

const prefs = createStore<Preferences>(read())

// Mudança feita em outra janela (ex.: janela de conversa).
window.addEventListener('storage', (e) => {
  if (e.key === KEY) prefs.set(read())
})

export function getPreferences(): Preferences {
  return prefs.get()
}

export function setPreferences(patch: Partial<Preferences>): void {
  prefs.set((p) => ({ ...p, ...patch }))
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs.get()))
  } catch {
    // Sem armazenamento, vale só até fechar o app.
  }
}

export function usePreferences(): Preferences {
  return useStore(prefs)
}

// Uma preferência só: redesenha apenas quando ela muda (ex.: usePreference('welcomeSeen')).
export function usePreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return useStore(prefs, (p) => p[key])
}
