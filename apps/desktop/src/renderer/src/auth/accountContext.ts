import { createContext, useContext } from 'react';

// Conta da conversa na tela (a do grupo da pasta, ainda sem resolver). Os seletores lá dentro
// pegam os modelos dela.
export const AccountContext = createContext<string | undefined>(undefined);

export function useConversationAccount(): string | undefined {
  return useContext(AccountContext);
}

// Pasta da conversa na tela. Diz onde o Claude dela roda: numa pasta do WSL, com o login de lá.
export const ConversationFolderContext = createContext<string | undefined>(undefined);

export function useConversationFolder(): string | undefined {
  return useContext(ConversationFolderContext);
}
