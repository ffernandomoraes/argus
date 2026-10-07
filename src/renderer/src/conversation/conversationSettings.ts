import { useEffect, useState } from 'react'
import { getPreferences, usePreferences } from '../settings/preferences'
import type { SessionSettings } from './SessionSettings'

// Trocas feitas nos seletores de uma conversa ficam só nela, guardadas neste computador.
// Até o primeiro envio, o que não foi trocado segue o padrão das Configurações; depois, fica fixo
// (ver freezeConversationSettings).
const key = (id: string) => `chat-settings:${id}`
const CHANGED = 'chat-settings-changed'

function read(id: string): Partial<SessionSettings> {
  try {
    return JSON.parse(localStorage.getItem(key(id)) ?? '{}') as Partial<SessionSettings>
  } catch {
    return {}
  }
}

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

export function useConversationSettings(id: string): SessionSettings {
  const prefs = usePreferences()
  const [saved, setSaved] = useState(() => read(id))
  useEffect(() => {
    setSaved(read(id))
    const refresh = () => setSaved(read(id))
    const onChanged = (e: Event) => (e as CustomEvent).detail === id && refresh()
    // Troca feita na janela separada da mesma conversa.
    const onStorage = (e: StorageEvent) => e.key === key(id) && refresh()
    window.addEventListener(CHANGED, onChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CHANGED, onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [id])
  return { ...prefs.conversation, ...saved }
}
