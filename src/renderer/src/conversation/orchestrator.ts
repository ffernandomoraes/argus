import { parseStepAgent, STEP_PROVIDER_NAMES, type OrchestratorConfig, type OrchestratorRule } from '../../../shared/orchestrator'
import { agentRef, parseAgentRef, type ProvidersState } from '../../../shared/providers'
import { tr } from '../i18n'

const rule = (task: string, model: string, effort = ''): OrchestratorRule => ({ id: crypto.randomUUID(), task, agent: 'claude', model, effort })

// Régua de partida: ler, documentar, executar e validar. A pessoa edita, apaga e acrescenta.
export function defaultRules(): OrchestratorRule[] {
  return [
    rule(tr('Achar arquivos, ler trechos de código, listar padrões. Resposta factual, sem julgamento', 'Find files, read code, list patterns. Factual answer, no judgment'), 'haiku'),
    rule(tr('Entender como as partes do sistema se conectam antes de decidir', 'Understand how parts of the system connect before deciding'), 'sonnet', 'medium'),
    rule(tr('Atualizar documentação, README ou FAQ', 'Update docs, README or FAQ'), 'sonnet', 'low'),
    rule(tr('Executar um plano claro em poucos arquivos', 'Carry out a clear plan in a few files'), 'sonnet', 'medium'),
    rule(tr('Executar mudança que toca várias partes ou exige escolher a solução', 'Make a change that touches several parts or requires choosing the solution'), 'opus', 'high'),
    rule(tr('Revisar mudança pequena: bugs, regressões, se o pedido foi atendido', 'Review a small change: bugs, regressions, whether the request was met'), 'sonnet', 'medium'),
    rule(tr('Revisar mudança em fluxo central ou difícil de desfazer', 'Review a change to a core flow or one that is hard to undo'), 'opus', 'high'),
    rule(tr('A tentativa anterior falhou ou o problema não tem causa clara', 'The previous attempt failed or the problem has no clear cause'), 'opus', 'max')
  ]
}

export function defaultOrchestrator(): OrchestratorConfig {
  return { agent: 'claude', model: 'opus', effort: 'high', rules: defaultRules(), extra: '' }
}

// Ligar o orquestrador numa conversa: ela já é do agente configurado (same), está vazia e passa a
// ser dele (adopt, com a conta a usar), ou começou com outro agente e não troca (blocked). Cada
// conversa fica presa ao agente com que começou: o histórico de cada um é próprio dele.
export type OrchestratorFit = { kind: 'same' } | { kind: 'adopt'; account: string } | { kind: 'blocked'; agent: string }

export function orchestratorFit(target: string | undefined, conversation: string | undefined, empty: boolean, claudeDefault: string, providers: ProvidersState | null): OrchestratorFit {
  const wanted = parseStepAgent(target) ?? { provider: 'claude' as const }
  const current = parseAgentRef(conversation)
  // A conta que a conversa usaria: a pedida ou a padrão do agente.
  const account =
    wanted.provider === 'claude'
      ? (wanted.account ?? (current ? claudeDefault : conversation ?? claudeDefault))
      : agentRef(wanted.provider, wanted.account ?? providers?.providers[wanted.provider].defaultId ?? 'main')
  const sameAgent = wanted.provider === 'claude' ? !current : conversation === account
  if (sameAgent && (wanted.provider !== 'claude' || !wanted.account || !empty || conversation === account)) return { kind: 'same' }
  if (empty) return { kind: 'adopt', account }
  return { kind: 'blocked', agent: STEP_PROVIDER_NAMES[wanted.provider] }
}
