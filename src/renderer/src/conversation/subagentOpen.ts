import { createContext } from 'react'

// Abre o histórico de um subagente da conversa, pela chamada da ferramenta Agent que o lançou.
// Nulo onde não há drawer para mostrar (a janela separada): a linha do subagente fica sem o botão.
export type OpenSubagent = (toolUseId: string, agent: string, description: string) => void

export const SubagentOpenContext = createContext<OpenSubagent | null>(null)
