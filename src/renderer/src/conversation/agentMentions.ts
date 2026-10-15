import type { AgentDef, AgentProvider } from '../../../shared/agents'

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

// Aviso para o agente, fora do balão do chat: o nome com @ é pedido para delegar, não só menção.
// Cada CLI chama subagente do seu jeito; o Cursor não tem agentes globais, então as instruções do
// agente vão no próprio aviso e a conversa segue com elas.
export function agentHint(called: AgentDef[], provider: AgentProvider = 'claude'): string | undefined {
  if (!called.length) return undefined
  const names = called.map((a) => `"${a.name}"`).join(', ')
  const asked = `A pessoa chamou com @ o(s) agente(s) ${names}.`
  if (provider === 'cursor') {
    const blocks = called.map((a) => `<agente nome="${a.name}">\n${a.prompt}\n</agente>`).join('\n')
    return `<agentes-chamados>${asked} Siga as instruções do(s) agente(s) abaixo para este pedido, como se fosse ele.\n${blocks}</agentes-chamados>`
  }
  if (provider === 'claude')
    return `<agentes-chamados>${asked} Delegue a tarefa usando a ferramenta Agent com subagent_type igual ao nome do agente, passando no prompt tudo o que ele precisa saber desta conversa.</agentes-chamados>`
  const how = provider === 'codex' ? 'criando um subagente do agente personalizado com esse nome' : 'chamando o subagente com esse nome'
  return `<agentes-chamados>${asked} Delegue a tarefa ${how}, passando no pedido tudo o que ele precisa saber desta conversa.</agentes-chamados>`
}
