import { useEffect } from 'react';
import type { ActiveConversation } from './CanvasContext';
import { displayPath } from './factory';
import { getPreferences, setPreferences, usePreference } from '../settings/preferences';

// Últimas conversas abertas num drawer, da mais recente para a mais antiga: a pasta (como no store)
// e o id da sessão do Claude. Servem ao histórico da barra de baixo, para achar a conversa aberta
// sem querer (a concluída sai do indicador ao ser vista).
export type RecentChat = { path: string; id: string };

export const RECENT_LIMIT = 10;

const same = (a: RecentChat, b: RecentChat) => a.id === b.id && a.path === b.path;

// Põe a conversa no topo. Já no topo, não regrava as preferências.
export function noteRecent(chat: RecentChat): void {
  const list = getPreferences().recentChats;
  if (list[0] && same(list[0], chat)) return;
  setPreferences({ recentChats: [chat, ...list.filter((c) => !same(c, chat))].slice(0, RECENT_LIMIT) });
}

export function useRecentChats(): RecentChat[] {
  return usePreference('recentChats');
}

// A conversa de um drawer que vale guardar: já tem sessão e não é subagente nem tarefas.
export function recentOf(conversation: ActiveConversation, path: string | undefined): RecentChat | null {
  if (!path || conversation.draft || conversation.subagent || conversation.tasks) return null;
  const id = conversation.sessionId;
  return id ? { path: displayPath(path), id } : null;
}

// Guarda as conversas que entram nos drawers (a conversa nova, ao ganhar a sessão).
export function useNoteRecent(entries: (RecentChat | null)[]): void {
  const key = entries.map((e) => (e ? `${e.path}\0${e.id}` : '')).join('\n');
  useEffect(() => {
    for (const line of key.split('\n')) {
      const [path, id] = line.split('\0');
      if (path && id) noteRecent({ path, id });
    }
  }, [key]);
}
