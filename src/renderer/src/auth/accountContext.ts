import { createContext, useContext } from 'react'

// Conta da conversa na tela (a do grupo da pasta, ainda sem resolver). Os seletores lá dentro
// pegam os modelos dela.
export const AccountContext = createContext<string | undefined>(undefined)

export function useConversationAccount(): string | undefined {
  return useContext(AccountContext)
}
