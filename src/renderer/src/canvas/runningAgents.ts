import { useSyncExternalStore } from 'react'
import type { RunningAgent } from '../../../shared/agents'

// Subagentes rodando em cada conversa aberta pelo chat do app. Vêm junto do estado do chat,
// que o processo principal manda para todas as janelas com cada chave da conversa (o id
// dela no app e o id da sessão do Claude).
const EMPTY: RunningAgent[] = []
const byKey = new Map<string, RunningAgent[]>()
const listeners = new Set<() => void>()
let version = 0

window.api.chat.onState((key, state) => {
  const agents = state.agents ?? EMPTY
  const current = byKey.get(key) ?? EMPTY
  if (current === agents || (current.length === 0 && agents.length === 0)) return
  if (agents.length) byKey.set(key, agents)
  else byKey.delete(key)
  version++
  listeners.forEach((l) => l())
})

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRunningAgents(conversationId: string): RunningAgent[] {
  return byKey.get(conversationId) ?? EMPTY
}

// Redesenha quando algum subagente começa, avança ou termina; os dados vêm de getRunningAgents.
export function useRunningAgentsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

// Subagente lançado por uma chamada da ferramenta Agent, enquanto roda.
export function useRunningAgent(toolUseId: string | undefined): RunningAgent | undefined {
  useRunningAgentsVersion()
  if (!toolUseId) return undefined
  for (const agents of byKey.values()) {
    const found = agents.find((a) => a.toolUseId === toolUseId)
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
