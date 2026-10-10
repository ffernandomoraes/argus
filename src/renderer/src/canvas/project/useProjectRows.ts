import { useRunningAgentsOf } from '../runningAgents'
import type { ConversationSummary } from '../types'
import { agentsKeyOf, legsOf, visibleConversations, withAgents, type Row } from './projectRows'

// Linhas da caixa da pasta: as conversas que aparecem (recolhida, só as que pedem atenção), cada
// uma com os subagentes rodando, e onde fica o meio de cada conversa (as perninhas).
// Assina só os subagentes das conversas que aparecem: redesenha quando algum deles começa, avança
// ou termina, e não com os de outra pasta.
export function useProjectRows(
  conversations: ConversationSummary[],
  collapsed: boolean
): { rows: Row[]; legs: { middle: number; running: boolean }[] } {
  const visible = visibleConversations(conversations, collapsed)
  const keys = visible.map(agentsKeyOf)
  const lists = useRunningAgentsOf(keys)
  const rows = withAgents(visible, (key) => lists[keys.indexOf(key)] ?? [])
  return { rows, legs: legsOf(rows) }
}
