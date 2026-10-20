import { useMemo } from 'react'
import { getPreferences, setPreferences, usePreference } from '../settings/preferences'
import type { ConversationSummary } from './types'

// Conversas favoritas: guardadas pelo id da sessão do Claude, que é o mesmo na lista da pasta e
// no drawer (a conversa nova só ganha um ao primeiro envio). Design não entra: tem lista própria.
export const favoriteKey = (c: ConversationSummary): string | null => (c.kind === 'design' ? null : (c.sessionId ?? null))

export function useFavorites(): ReadonlySet<string> {
  const ids = usePreference('favoriteChats')
  return useMemo(() => new Set(ids), [ids])
}

export function useIsFavorite(c: ConversationSummary): boolean {
  const key = favoriteKey(c)
  return usePreference('favoriteChats').includes(key ?? '')
}

export function isFavorite(c: ConversationSummary): boolean {
  const key = favoriteKey(c)
  return !!key && getPreferences().favoriteChats.includes(key)
}

export function setFavorite(c: ConversationSummary, on: boolean): void {
  const key = favoriteKey(c)
  if (!key) return
  const ids = getPreferences().favoriteChats.filter((id) => id !== key)
  setPreferences({ favoriteChats: on ? [...ids, key] : ids })
}
