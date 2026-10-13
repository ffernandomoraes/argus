import type { OrchestratorConfig, OrchestratorRule } from '../../../shared/orchestrator'
import { tr } from '../i18n'

const rule = (task: string, model: string, effort = ''): OrchestratorRule => ({ id: crypto.randomUUID(), task, model, effort })

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
  return { model: 'opus', effort: 'high', rules: defaultRules(), extra: '' }
}
