import { isInterfaceZoom } from '../../../shared/interfaceZoom'
import type { OrchestratorConfig } from '../../../shared/orchestrator'
import { DEFAULT_LOOK, normalizeLook, type MascotLook } from '../canvas/mascot/look'
import { defaultOrchestrator } from '../conversation/orchestrator'
import { DEFAULT_SETTINGS, type SessionSettings } from '../conversation/SessionSettings'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Preferências do app, salvas neste computador. Valem em todas as janelas.
export type Preferences = {
  // Onde a conversa abre ao ser clicada no canvas. 'node' = bloco dentro do canvas, como o terminal.
  openIn: 'panel' | 'window' | 'node'
  // Escala do conteúdo do drawer, ajustada com ⌘+ / ⌘- (ver useDrawerZoom).
  drawerZoom: number
  // Tamanho da interface inteira, para monitores maiores ou menores (Configurações > Aparência).
  interfaceZoom: number
  // Modelo, esforço, modo etc. de cada conversa, até ser trocado no próprio chat (conversationSettings).
  conversation: SessionSettings
  // Boas-vindas vistas até o fim neste computador. Falso abre o passo a passo de novo.
  welcomeSeen: boolean
  // Versão dos padrões da conversa já aplicada. Até a 2, thinking vinha ligado e ficava salvo.
  conversationDefaults: number
  // Player da música que toca no sistema, na barra de título (MediaControls).
  mediaPlayer: boolean
  // Mascote solto na tela, por cima de qualquer app (canvas/mascot). O lugar dele fica no
  // processo principal (AppSettings.mascotSpot), que é quem move a janela.
  mascot: boolean
  // Visual do mascote e o golpe no envio (Configurações > Mascote).
  mascotLook: MascotLook
  // Modo orquestrador disponível (Configurações > Experimentos): mostra a aba e o item no seletor.
  orchestratorEnabled: boolean
  // Codex, Gemini e Cursor além do Claude (Configurações > Experimentos): contas e conversas.
  multiAgents: boolean
  // Modo design (Configurações > Experimentos): "Novo design" na pasta, os designs na lista dela e o
  // drawer do design. Desligado, nada disso aparece (os designs continuam guardados).
  designMode: boolean
  // Worktrees (Configurações > Experimentos): "Nova tarefa em paralelo" no menu da pasta, que cria um git
  // worktree como card filho dela.
  worktrees: boolean
  // Transcrição de áudio anexado (Configurações > Experimentos): o texto do áudio vai junto da
  // mensagem. O modelo é baixado na primeira vez, se a pessoa aceitar.
  audioTranscription: boolean
  // Modelo e esforço do orquestrador e as regras de delegação dele (Configurações > Orquestrador).
  orchestrator: OrchestratorConfig
  // Conversas favoritas (id da sessão do Claude): ficam no topo da lista de todas as conversas.
  favoriteChats: string[]
}

const KEY = 'preferences'
const CONVERSATION_DEFAULTS = 2
const DEFAULTS: Preferences = {
  openIn: 'panel',
  drawerZoom: 1,
  interfaceZoom: 1,
  conversation: DEFAULT_SETTINGS,
  welcomeSeen: false,
  conversationDefaults: CONVERSATION_DEFAULTS,
  mediaPlayer: true,
  mascot: false,
  mascotLook: DEFAULT_LOOK,
  orchestratorEnabled: false,
  multiAgents: false,
  designMode: false,
  worktrees: false,
  audioTranscription: false,
  orchestrator: defaultOrchestrator(),
  favoriteChats: []
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
      conversationDefaults: CONVERSATION_DEFAULTS,
      interfaceZoom: isInterfaceZoom(saved.interfaceZoom) ? saved.interfaceZoom : 1,
      mascotLook: normalizeLook(saved.mascotLook)
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
