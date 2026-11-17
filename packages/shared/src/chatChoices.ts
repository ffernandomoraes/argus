import type { ChatSettings } from './chat';

// Conta e modelo/esforço/modo escolhidos em cada conversa. Ficam no Argus que roda a conversa, não
// na janela: a janela daqui, a do acesso remoto (no outro computador) e o celular leem o mesmo. Antes
// cada janela guardava os seus e a conversa trocava de conta sozinha ao ser continuada na outra.
// Chave: o id da sessão, ou o provisório da conversa nova até o primeiro envio (ver move).
export type ConversationChoice = { account?: string; settings?: Partial<ChatSettings> };

// Por cima (troca no seletor) ou só no que falta (primeiro envio, as guardadas pelas versões antigas).
export function mergeChoice(base: ConversationChoice | undefined, patch: ConversationChoice, onlyMissing: boolean): ConversationChoice {
  const [under, over] = onlyMissing ? [patch, base ?? {}] : [base ?? {}, patch];
  const settings = { ...under.settings, ...over.settings };
  const account = over.account ?? under.account;
  return { ...(account && { account }), ...(Object.keys(settings).length && { settings }) };
}

export type ChatChoicesInvokeChannels = {
  // Todas, para a janela começar.
  'chatChoices:all': () => Record<string, ConversationChoice>
};

export type ChatChoicesSendChannels = {
  // Troca feita no seletor: vale por cima do que havia.
  'chatChoices:set': (id: string, choice: ConversationChoice) => void
  // Primeiro envio: guarda o que valia, sem passar por cima do que já foi escolhido (em outra janela).
  'chatChoices:freeze': (id: string, choice: ConversationChoice) => void
  // Conversa nova ganhou o id da sessão: o escolhido vai junto.
  'chatChoices:move': (from: string, to: string) => void
  // As guardadas na janela pelas versões antigas: entram só onde não há nada.
  'chatChoices:seed': (choices: Record<string, ConversationChoice>) => void
};

export type ChatChoicesEventChannels = {
  // Mudou a de uma conversa (nula: apagada, depois de mudar de id).
  'chatChoices:changed': (id: string, choice: ConversationChoice | null) => void
};
