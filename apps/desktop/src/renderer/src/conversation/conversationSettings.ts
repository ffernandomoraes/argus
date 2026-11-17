import { useMemo, useSyncExternalStore } from 'react';
import { getPreferences, usePreference } from '../settings/preferences';
import type { SessionSettings } from './SessionSettings';
import { choiceOf, freezeChoice, moveChoice, setChoice, subscribeChoices } from './conversationChoices';

// Trocas feitas nos seletores de uma conversa ficam só nela, guardadas no Argus que roda a conversa
// (ver conversationChoices.ts): a janela do acesso remoto e esta veem as mesmas.
// Até o primeiro envio, o que não foi trocado segue o padrão das Configurações; depois, fica fixo
// (ver freezeConversationSettings).
const read = (id: string): Partial<SessionSettings> => choiceOf(id)?.settings ?? {};

export function getConversationSettings(id: string | undefined): SessionSettings {
  return { ...getPreferences().conversation, ...(id ? read(id) : {}) };
}

export function setConversationSettings(id: string, patch: Partial<SessionSettings>): void {
  setChoice(id, { settings: patch });
}

// A sessão do Claude recebe modelo, modo etc. só ao abrir; mudar o padrão nas Configurações
// depois não chega nela. Guarda o que valia no envio para a tela não mostrar o que não vale.
export function freezeConversationSettings(id: string, settings: SessionSettings): void {
  freezeChoice(id, { settings });
}

// Conversa nova ganha o id da sessão no primeiro envio: o que foi trocado antes vai junto (a conta
// também, ver moveConversationAccount).
export function moveConversationSettings(from: string, to: string): void {
  moveChoice(from, to);
}

// O mesmo objeto enquanto nada muda: vai para o chat e para os seletores memorizados.
export function useConversationSettings(id: string): SessionSettings {
  const defaults = usePreference('conversation');
  const saved = useSyncExternalStore(subscribeChoices, () => choiceOf(id)?.settings);
  return useMemo(() => ({ ...defaults, ...saved }), [defaults, saved]);
}
