import { useMemo, useSyncExternalStore } from 'react'
import { getPreferences, usePreference } from '../settings/preferences'
import type { SessionSettings } from './SessionSettings'

// Trocas feitas nos seletores de uma conversa ficam só nela, guardadas neste computador.
// Até o primeiro envio, o que não foi trocado segue o padrão das Configurações; depois, fica fixo
// (ver freezeConversationSettings).
const key = (id: string) => `chat-settings:${id}`
const CHANGED = 'chat-settings-changed'

function readRaw(id: string): string | null {
  try {
    return localStorage.getItem(key(id))
  } catch {
    return null
  }
}

function parse(raw: string | null): Partial<SessionSettings> {
  try {
    return JSON.parse(raw ?? '{}') as Partial<SessionSettings>
  } catch {
    return {}
  }
}

const read = (id: string) => parse(readRaw(id))

function write(id: string, value: Partial<SessionSettings>): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(value))
  } catch {
    // Sem armazenamento, a troca vale só até fechar o app.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: id }))
}

export function getConversationSettings(id: string | undefined): SessionSettings {
  return { ...getPreferences().conversation, ...(id ? read(id) : {}) }
}

export function setConversationSettings(id: string, patch: Partial<SessionSettings>): void {
  write(id, { ...read(id), ...patch })
}

// A sessão do Claude recebe modelo, modo etc. só ao abrir; mudar o padrão nas Configurações
// depois não chega nela. Guarda o que valia no envio para a tela não mostrar o que não vale.
export function freezeConversationSettings(id: string, settings: SessionSettings): void {
  const saved = read(id)
  if (Object.keys(settings).every((k) => k in saved)) return
  write(id, { ...settings, ...saved })
}

// Conversa nova ganha o id da sessão no primeiro envio: o que foi trocado antes vai junto.
export function moveConversationSettings(from: string, to: string): void {
  const saved = read(from)
  if (!Object.keys(saved).length) return
  write(to, { ...read(to), ...saved })
  try {
    localStorage.removeItem(key(from))
  } catch {
    // Sem armazenamento, não havia o que mover.
  }
}

// Troca feita aqui (CHANGED) ou na janela separada da mesma conversa (storage). Cada conversa na
// tela relê só a sua chave e redesenha se o texto guardado mudou.
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// O mesmo objeto enquanto nada muda: vai para o chat e para os seletores memorizados.
export function useConversationSettings(id: string): SessionSettings {
  const defaults = usePreference('conversation')
  const raw = useSyncExternalStore(subscribe, () => readRaw(id))
  return useMemo(() => ({ ...defaults, ...parse(raw) }), [defaults, raw])
}
