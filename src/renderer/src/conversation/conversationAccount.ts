import { createContext, useContext, useSyncExternalStore } from 'react'

// Conta do Claude escolhida para uma conversa, guardada neste computador. Só se escolhe com a
// conversa vazia; no primeiro envio ela fica fixa (a escolhida ou, sem escolha, a do grupo), e a
// conversa continua nela mesmo se o grupo trocar de conta. Conversas de antes disso, sem conta
// guardada, seguem o grupo.
const key = (id: string) => `chat-account:${id}`
const CHANGED = 'chat-account-changed'

function read(id: string): string | undefined {
  try {
    return localStorage.getItem(key(id)) ?? undefined
  } catch {
    return undefined
  }
}

export function setConversationAccount(id: string, account: string): void {
  try {
    localStorage.setItem(key(id), account)
  } catch {
    // Sem armazenamento, a escolha vale só até fechar o app.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: id }))
}

// No primeiro envio: guarda a que vai rodar, se nada foi escolhido.
export function freezeConversationAccount(id: string, account: string): void {
  if (!read(id)) setConversationAccount(id, account)
}

// Conversa nova ganha o id da sessão no primeiro envio: a conta vai junto.
export function moveConversationAccount(from: string, to: string): void {
  const saved = read(from)
  if (!saved) return
  setConversationAccount(to, saved)
  try {
    localStorage.removeItem(key(from))
  } catch {
    // Sem armazenamento, não havia o que mover.
  }
}

// Troca feita aqui (CHANGED) ou na janela separada da mesma conversa (storage).
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useConversationAccountChoice(id: string): string | undefined {
  return useSyncExternalStore(subscribe, () => read(id))
}

// A conversa na tela: se ainda está vazia (pode trocar para qualquer agente) e como trocar. O
// orquestrador usa para levar a conversa nova ao agente dele (ver orchestratorFit).
export type AccountChoice = { empty: boolean; choose: (account: string) => void }

export const AccountChoiceContext = createContext<AccountChoice | null>(null)

export const useAccountChoice = (): AccountChoice | null => useContext(AccountChoiceContext)
