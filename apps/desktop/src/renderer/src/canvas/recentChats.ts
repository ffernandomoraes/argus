import { useMemo } from 'react';
import type { ActiveChat } from '@argus/shared/chat';
import { useStore } from '../lib/useStore';
import { activeChats } from './activeChats';
import { store as sessionsStore } from './sessionsStore/state';
import { displayPath } from './factory';
import { getPreferences, setPreferences, usePreference } from '../settings/preferences';

// Histórico da barra de baixo: as últimas conversas que tiveram atividade (trabalharam, pediram
// você ou concluíram), da mais recente para a mais antiga, com a pasta (como no store) e o id da
// sessão do Claude. Conversa só aberta para olhar não entra. Serve para achar a concluída que saiu
// do indicador ao ser vista sem querer.
export type RecentChat = { path: string; id: string };

export const RECENT_LIMIT = 10;

const same = (a: RecentChat, b: RecentChat) => a.id === b.id && a.path === b.path;

// Põe as conversas no topo, a primeira da lista por cima. Sem mudança, não regrava as preferências.
function noteRecent(chats: RecentChat[]): void {
  const list = getPreferences().chatHistory;
  if (!chats.length || chats.every((c, i) => list[i] && same(list[i], c))) return;
  const rest = list.filter((c) => !chats.some((n) => same(n, c)));
  setPreferences({ chatHistory: [...chats, ...rest].slice(0, RECENT_LIMIT) });
}

// As registradas e, enquanto não chegam a 10, as que tiveram resposta por último nas pastas lidas
// (as dos workspaces, ver allWorkspaces.ts): a lista já nasce cheia.
export function useRecentChats(): RecentChat[] {
  const noted = usePreference('chatHistory');
  const sessions = useStore(sessionsStore, (s) => s.sessions);
  return useMemo(() => {
    if (noted.length >= RECENT_LIMIT) return noted;
    const others = [...sessions]
      .flatMap(([path, list]) => list.filter((c) => !c.draft).map((c) => ({ path, id: c.sessionId ?? c.id, at: c.repliedAt })))
      .filter((c) => !noted.some((n) => same(n, c)))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, RECENT_LIMIT - noted.length)
      .map(({ path, id }) => ({ path, id }));
    return [...noted, ...others];
  }, [noted, sessions]);
}

const recentOf = (c: ActiveChat): RecentChat | null => (c.sessionId ? { path: displayPath(c.cwd), id: c.sessionId } : null);

// Acompanha as conversas ativas do app: sobe ao topo a que começou a trabalhar, mudou de estado
// (passou a precisar de você) ou saiu da lista (concluiu ou parou).
let seen = new Map<string, ActiveChat>();
function track(): void {
  const now = new Map(activeChats.get().map((c) => [c.key, c]));
  const changed: ActiveChat[] = [];
  for (const [key, c] of now) {
    const before = seen.get(key);
    if (!before || before.status !== c.status || (!before.sessionId && c.sessionId)) changed.push(c);
  }
  for (const [key, c] of seen) if (!now.has(key)) changed.push(c);
  seen = now;
  noteRecent(changed.map(recentOf).filter((c): c is RecentChat => !!c));
}
activeChats.subscribe(track);
track();
