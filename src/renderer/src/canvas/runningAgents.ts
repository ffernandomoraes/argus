import type { RunningAgent } from '../../../shared/agents'
import { createStore } from '../lib/createStore'
import { shallowEqual } from '../lib/shallowEqual'
import { useStore } from '../lib/useStore'

// Subagentes rodando em cada conversa aberta pelo chat do app. Vêm junto do estado do chat,
// que o processo principal manda para todas as janelas com cada chave da conversa (o id
// dela no app e o id da sessão do Claude).
const EMPTY: RunningAgent[] = []

// A lista de uma conversa só troca de referência quando muda de verdade: quem lê por seletor
// (useRunningAgents, useRunningAgentsOf) redesenha só com os subagentes que mostra.
type Agents = { byKey: ReadonlyMap<string, RunningAgent[]> }
const agents = createStore<Agents>({ byKey: new Map() })

// O IPC entrega uma lista nova a cada estado do chat (dezenas por segundo enquanto o texto chega),
// quase sempre com o mesmo conteúdo: comparar a referência redesenhava todas as pastas a cada uma.
const sameAgents = (a: RunningAgent[], b: RunningAgent[]) =>
  a.length === b.length && (a.length === 0 || JSON.stringify(a) === JSON.stringify(b))

window.api.chat.onState((key, state) => {
  const next = state.agents ?? EMPTY
  agents.set((s) => {
    if (sameAgents(s.byKey.get(key) ?? EMPTY, next)) return s
    const byKey = new Map(s.byKey)
    if (next.length) byKey.set(key, next)
    else byKey.delete(key)
    return { byKey }
  })
})

// Subagentes de uma conversa (pela chave dela); redesenha só quando os dela mudam.
export function useRunningAgents(key: string | undefined): RunningAgent[] {
  return useStore(agents, (s) => (key ? (s.byKey.get(key) ?? EMPTY) : EMPTY))
}

// Subagentes de várias conversas, na ordem das chaves (as linhas da caixa da pasta). Redesenha só
// quando os de alguma delas mudam: subagente de outra pasta não mexe nesta.
export function useRunningAgentsOf(keys: readonly string[]): RunningAgent[][] {
  return useStore(agents, (s) => keys.map((key) => (key ? (s.byKey.get(key) ?? EMPTY) : EMPTY)), shallowEqual)
}

// Subagente lançado por uma chamada da ferramenta Agent, enquanto roda. Redesenha só quando ele muda.
export function useRunningAgent(toolUseId: string | undefined): RunningAgent | undefined {
  return useStore(agents, (s) => (toolUseId ? findAgent(s.byKey, toolUseId) : undefined))
}

function findAgent(byKey: ReadonlyMap<string, RunningAgent[]>, toolUseId: string): RunningAgent | undefined {
  for (const list of byKey.values()) {
    const found = list.find((a) => a.toolUseId === toolUseId)
    if (found) return found
  }
  return undefined
}

// O que o agente está fazendo agora: a frase dele ou, até ela chegar, a última ferramenta.
export function agentActivity(a: RunningAgent): string {
  if (a.summary) return a.summary
  const last = a.steps.at(-1)
  if (last) return last.summary ? `${last.label} - ${last.summary}` : last.label
  return 'Começando…'
}
