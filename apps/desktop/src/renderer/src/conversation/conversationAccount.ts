import { useSyncExternalStore } from 'react';
import { choiceOf, freezeChoice, moveChoice, setChoice, subscribeChoices } from './conversationChoices';

// Conta do Claude escolhida para uma conversa, guardada no Argus que roda a conversa (ver
// conversationChoices.ts): a janela do acesso remoto e esta veem a mesma. Só se escolhe com a
// conversa vazia; no primeiro envio ela fica fixa (a escolhida ou, sem escolha, a do grupo), e a
// conversa continua nela mesmo se o grupo trocar de conta. Conversas de antes disso, sem conta
// guardada, seguem o grupo.

export function setConversationAccount(id: string, account: string): void {
  setChoice(id, { account });
}

// No primeiro envio: guarda a que vai rodar, se nada foi escolhido.
export function freezeConversationAccount(id: string, account: string): void {
  freezeChoice(id, { account });
}

// Conversa nova ganha o id da sessão no primeiro envio: a conta vai junto (com o modelo e o resto).
export function moveConversationAccount(from: string, to: string): void {
  moveChoice(from, to);
}

export function useConversationAccountChoice(id: string): string | undefined {
  return useSyncExternalStore(subscribeChoices, () => choiceOf(id)?.account);
}
