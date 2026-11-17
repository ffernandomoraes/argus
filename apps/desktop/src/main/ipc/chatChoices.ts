import type { ChatDetails, ChatSettings } from '@argus/shared/chat';
import type { Chats } from '../chats';
import type { ChatChoices } from '../chats/choices';
import { phonePreferences } from '../phonePreferences';
import { handle, on } from './register';

const NO_SETTINGS: ChatSettings = { model: '', effort: '', thinking: false, ultracode: false, permissionMode: '' };

// Conta e modelo/esforço/modo de cada conversa (ver chats/choices.ts), e o que o celular mostra nos
// seletores: o da sessão aberta ou, com ela fechada, o escolhido nas janelas.
export function registerChatChoicesIpc(chats: Chats, choices: ChatChoices): void {
  handle('chatChoices:all', () => choices.all());
  on('chatChoices:set', (_e, id, choice) => choices.set(id, choice));
  on('chatChoices:freeze', (_e, id, choice) => choices.freeze(id, choice));
  on('chatChoices:move', (_e, from, to) => choices.move(from, to));
  on('chatChoices:seed', (_e, all) => choices.seed(all));
  handle('chat:details', (_e, key): ChatDetails | null => {
    const live = chats.details(key);
    if (live) return live;
    const saved = choices.get(key);
    if (!saved?.account) return null;
    return { account: saved.account, settings: { ...(phonePreferences()?.conversation ?? NO_SETTINGS), ...saved.settings } };
  });
}
