import type { AgentDef } from '../../../shared/agents'

export type AgentMention = { start: number; items: AgentDef[] }

// "@clo" no fim do texto → agentes que começam com "clo". start: onde o @ começa, para trocar
// o pedaço digitado pelo nome inteiro. Nenhum agente com esse começo: sem menu, e o Enter
// continua enviando (um @ qualquer no texto não trava o envio).
export function matchAgents(draft: string, agents: AgentDef[]): AgentMention | null {
  const m = draft.match(/(^|\s)@([\w-]*)$/)
  if (!m || agents.length === 0) return null
  const query = m[2].toLowerCase()
  const items = agents.filter((a) => a.name.startsWith(query))
  return items.length ? { start: draft.length - m[2].length - 1, items } : null
}

// Agentes chamados com @nome no texto enviado.
export function mentionedAgents(text: string, agents: AgentDef[]): AgentDef[] {
  return agents.filter((a) => new RegExp(`(^|\\s)@${a.name}(?![\\w-])`).test(text))
}

// Aviso para o Claude, fora do balão do chat: o nome com @ é pedido para delegar, não só menção.
export function agentHint(called: AgentDef[]): string | undefined {
  if (!called.length) return undefined
  const names = called.map((a) => `"${a.name}"`).join(', ')
  return `<agentes-chamados>A pessoa chamou com @ o(s) agente(s) ${names}. Delegue a tarefa usando a ferramenta Agent com subagent_type igual ao nome do agente, passando no prompt tudo o que ele precisa saber desta conversa.</agentes-chamados>`
}
