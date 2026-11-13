import { useTerminalBinding } from './useTerminalBinding'

// Só existe enquanto o terminal do `claude` ainda não sabe qual é a conversa dele: o shell não
// cria conversa e, amarrada a conversa, não há mais o que esperar.
export function TerminalBinding({ nodeId }: { nodeId: string }) {
  useTerminalBinding(nodeId)
  return null
}
