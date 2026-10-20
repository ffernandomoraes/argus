import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { AGENT_MODELS, usesEffort, type OrchestratorConfig, type OrchestratorRule } from '../../../../shared/orchestrator'
import { INPUT } from '../../agents/Field'
import { EFFORTS, groupByFamily } from '../../conversation/ModelEffortPicker'
import { defaultRules } from '../../conversation/orchestrator'
import { useClaudeInfo } from '../../conversation/useModels'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Group, Row, Segmented, Select } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Como o orquestrador age quando é ligado numa conversa (no seletor de modelo do chat): o modelo
// dele e as regras de qual modelo e esforço cada tipo de etapa recebe.
export function OrchestratorSection() {
  const o = usePreference('orchestrator')
  const models = useClaudeInfo()?.models ?? []
  const set = (patch: Partial<OrchestratorConfig>) => setPreferences({ orchestrator: { ...o, ...patch } })
  const setRule = (id: string, patch: Partial<OrchestratorRule>) => set({ rules: o.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const current = models.find((m) => m.value === o.model)
  const efforts = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS

  return (
    <>
      <Group>
        <Row
          label={tr('Modelo do orquestrador', 'Orchestrator model')}
          description={tr('A conversa passa a usar este modelo quando o orquestrador é ligado nela.', 'The chat switches to this model when the orchestrator is turned on in it.')}
        >
          <Select value={o.model} onChange={(model) => set({ model })}>
            {groupByFamily(models).map(([family, versions]) => (
              <optgroup key={family} label={family}>
                {versions.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Row>
        {efforts.length > 0 && (
          <Row below label={tr('Esforço', 'Effort')}>
            <Segmented
              value={o.effort}
              onChange={(effort) => set({ effort })}
              options={[{ value: '', label: 'Auto' }, ...efforts.map((e) => ({ value: e.value, label: e.label }))]}
            />
          </Row>
        )}
      </Group>

      <h2 className="mb-1 mt-6 text-[16px] font-semibold text-text">{tr('Regras', 'Rules')}</h2>
      <p className="mb-3 text-[15px] leading-relaxed text-muted">
        {tr(
          'Que modelo e esforço cada tipo de etapa recebe. Descreva a tarefa como falaria para alguém: "atualizar FAQ" funciona melhor que "coisas simples". O que nenhuma regra cobrir, o orquestrador decide sozinho.',
          'Which model and effort each kind of step gets. Describe the task as you would to a person: "update the FAQ" works better than "simple stuff". Anything no rule covers, the orchestrator decides on its own.'
        )}
      </p>
      <Group>
        {o.rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-line py-2.5 last:border-0">
            <input
              value={r.task}
              onChange={(e) => setRule(r.id, { task: e.target.value })}
              placeholder={tr('Tipo de tarefa', 'Kind of task')}
              aria-label={tr('Tipo de tarefa', 'Kind of task')}
              className={`${INPUT} min-w-0 flex-1 py-1 text-[15px]`}
            />
            <Select compact label={tr('Modelo', 'Model')} value={r.model} onChange={(model) => setRule(r.id, { model })}>
              {AGENT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select
              compact
              label={tr('Esforço', 'Effort')}
              disabled={!usesEffort(r.model)}
              value={usesEffort(r.model) ? r.effort : ''}
              onChange={(effort) => setRule(r.id, { effort })}
            >
              <option value="">Auto</option>
              {EFFORTS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </Select>
            <IconButton label={tr('Apagar regra', 'Delete rule')} size="sm" onClick={() => set({ rules: o.rules.filter((x) => x.id !== r.id) })}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        ))}
        {o.rules.length === 0 && <div className="py-3 text-[15px] text-muted">{tr('Nenhuma regra. O orquestrador decide tudo sozinho.', 'No rules. The orchestrator decides everything on its own.')}</div>}
      </Group>
      <div className="mt-2 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => set({ rules: [...o.rules, { id: crypto.randomUUID(), task: '', model: 'sonnet', effort: 'medium' }] })}
        >
          <Plus size={13} />
          {tr('Adicionar regra', 'Add rule')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => set({ rules: defaultRules() })}>
          <RotateCcw size={13} />
          {tr('Restaurar padrão', 'Restore defaults')}
        </Button>
      </div>

      <h2 className="mb-1 mt-6 text-[16px] font-semibold text-text">{tr('Instruções extras', 'Extra instructions')}</h2>
      <p className="mb-3 text-[15px] leading-relaxed text-muted">
        {tr('O que não cabe numa regra. Vai junto para o orquestrador.', 'Anything that doesn’t fit a rule. Sent to the orchestrator too.')}
      </p>
      <textarea
        value={o.extra}
        onChange={(e) => set({ extra: e.target.value })}
        rows={3}
        placeholder={tr('Ex.: sempre valide com Opus quando mexer em pagamento.', 'E.g.: always validate with Opus when touching payments.')}
        className={`${INPUT} w-full resize-y text-[15px]`}
      />
    </>
  )
}
