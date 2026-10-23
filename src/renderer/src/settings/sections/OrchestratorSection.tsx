import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { AGENT_MODELS, parseStepAgent, usesEffort, type OrchestratorConfig, type OrchestratorRule } from '../../../../shared/orchestrator'
import { agentRef, PROVIDER_NAMES, PROVIDERS } from '../../../../shared/providers'
import { INPUT } from '../../agents/Field'
import { useAuth } from '../../auth/useAuth'
import { EFFORTS, groupByFamily } from '../../conversation/ModelEffortPicker'
import { defaultRules } from '../../conversation/orchestrator'
import { useClaudeInfo, useModelsLoading } from '../../conversation/useModels'
import { useProviders } from '../../providers/useProviders'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Group, Row, Select } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

// Como o orquestrador age quando é ligado numa conversa (no seletor de modelo do chat): o modelo
// dele e as regras de qual agente, modelo e esforço cada tipo de etapa recebe.
export function OrchestratorSection() {
  const o = usePreference('orchestrator')
  const agents = useAgentOptions()
  const set = (patch: Partial<OrchestratorConfig>) => setPreferences({ orchestrator: { ...o, ...patch } })
  const setRule = (id: string, patch: Partial<OrchestratorRule>) => set({ rules: o.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <>
      <Group>
        <Row
          below
          label={tr('Orquestrador', 'Orchestrator')}
          description={tr('Quem divide o pedido e delega as etapas.', 'Who splits the request and delegates the steps.')}
          info={tr(
            'Quem divide o pedido e delega as etapas, de qualquer empresa. Ligar o orquestrador numa conversa nova faz ela usar este agente e este modelo. Uma conversa que já começou com outro agente continua com ele: para usar este, inicie uma conversa nova.',
            'Who splits the request and delegates the steps, from any company. Turning the orchestrator on in a new chat makes it use this agent and model. A chat that already started with another agent stays with it: to use this one, start a new chat.'
          )}
        >
          <AgentModelFields value={{ agent: o.agent || 'claude', model: o.model, effort: o.effort }} agents={agents} onChange={(patch) => set(patch)} />
        </Row>
      </Group>

      <h2 className="mb-1 mt-6 text-[16px] font-semibold text-text">{tr('Regras', 'Rules')}</h2>
      <p className="mb-3 text-[15px] leading-relaxed text-muted">
        {tr(
          'Que agente, modelo e esforço cada tipo de etapa recebe. Pode ser de qualquer empresa: o Claude orquestra e o Codex executa, por exemplo. Descreva a tarefa como falaria para alguém: "atualizar FAQ" funciona melhor que "coisas simples". O que nenhuma regra cobrir, o orquestrador decide sozinho.',
          'Which agent, model and effort each kind of step gets. Any company works: Claude orchestrates and Codex executes, for example. Describe the task as you would to a person: "update the FAQ" works better than "simple stuff". Anything no rule covers, the orchestrator decides on its own.'
        )}
      </p>
      <Group>
        {o.rules.map((r) => (
          <RuleRow
            key={r.id}
            rule={r}
            agents={agents}
            onChange={(patch) => setRule(r.id, patch)}
            onDelete={() => set({ rules: o.rules.filter((x) => x.id !== r.id) })}
          />
        ))}
        {o.rules.length === 0 && <div className="py-3 text-[15px] text-muted">{tr('Nenhuma regra. O orquestrador decide tudo sozinho.', 'No rules. The orchestrator decides everything on its own.')}</div>}
      </Group>
      <div className="mt-2 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => set({ rules: [...o.rules, { id: crypto.randomUUID(), task: '', agent: 'claude', model: 'sonnet', effort: 'medium' }] })}
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

type AgentOption = { value: string; label: string }

// Quem pode executar uma etapa: o Claude (cada conta, quando há mais de uma) e cada conta conectada
// do Codex, Gemini e Cursor.
function useAgentOptions(): AgentOption[] {
  const auth = useAuth()
  const providers = useProviders()
  const claude = auth?.accounts ?? []
  const options: AgentOption[] = [{ value: 'claude', label: claude.length > 1 ? tr('Claude (conta padrão)', 'Claude (default account)') : 'Claude' }]
  if (claude.length > 1) for (const a of claude) options.push({ value: `claude:${a.id}`, label: `Claude - ${a.name}` })
  for (const p of PROVIDERS) {
    const accounts = (providers?.providers[p].accounts ?? []).filter((a) => a.status?.signedIn !== false)
    for (const a of accounts) options.push({ value: agentRef(p, a.id), label: accounts.length > 1 ? `${PROVIDER_NAMES[p]} - ${a.name}` : PROVIDER_NAMES[p] })
  }
  return options
}

// Uma regra: o tipo de tarefa na primeira linha; agente, modelo e esforço embaixo.
function RuleRow({ rule, agents, onChange, onDelete }: { rule: OrchestratorRule; agents: AgentOption[]; onChange: (patch: Partial<OrchestratorRule>) => void; onDelete: () => void }) {
  return (
    <div className="border-b border-line py-2.5 last:border-0">
      <div className="flex items-center gap-2">
        <input
          value={rule.task}
          onChange={(e) => onChange({ task: e.target.value })}
          placeholder={tr('Tipo de tarefa', 'Kind of task')}
          aria-label={tr('Tipo de tarefa', 'Kind of task')}
          className={`${INPUT} min-w-0 flex-1 py-1 text-[15px]`}
        />
        <IconButton label={tr('Apagar regra', 'Delete rule')} size="sm" onClick={onDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>
      <div className="mt-2">
        <AgentModelFields aliases value={{ agent: rule.agent || 'claude', model: rule.model, effort: rule.effort }} agents={agents} onChange={onChange} />
      </div>
    </div>
  )
}

type AgentModel = { agent: string; model: string; effort: string }

// Agente, modelo e esforço lado a lado. Os modelos são as versões que a conta escolhida oferece
// (as mesmas do seletor de modelo do chat), agrupadas por família. aliases: os apelidos do Claude
// ("Opus" = sempre a versão mais nova), que as etapas aceitam.
function AgentModelFields({ value, agents, onChange, aliases: withAliases }: { value: AgentModel; agents: AgentOption[]; onChange: (patch: Partial<AgentModel>) => void; aliases?: boolean }) {
  const { agent } = value
  const parsed = parseStepAgent(agent)
  const claude = !parsed || parsed.provider === 'claude'
  // Sem conta: a padrão (Claude) ou a primeira da lista (outro agente).
  const account = claude ? parsed?.account : agent.includes(':') ? agent : agents.find((a) => a.value.startsWith(`${agent}:`))?.value
  const info = useClaudeInfo(account)
  // Codex, Gemini e Cursor listam os modelos abrindo o CLI: leva alguns segundos. Os do Claude já
  // chegam com o app (e os apelidos valem enquanto isso).
  const loading = useModelsLoading(account) && !claude
  const versions = info?.models ?? []
  const fallback = versions.find((m) => m.value === '')
  const aliases = claude && withAliases ? AGENT_MODELS.map((m) => ({ value: m.value, displayName: m.label, efforts: usesEffort(m.value) ? EFFORTS.map((e) => e.value) : [] })) : []
  const current = [...versions, ...aliases].find((m) => m.value === value.model)
  const efforts = EFFORTS.filter((e) => current?.efforts.includes(e.value))
  // Agente que não está mais conectado continua na lista, para não trocar sem você ver.
  const options = agents.some((a) => a.value === agent) ? agents : [...agents, { value: agent, label: `${agent} (${tr('desconectado', 'disconnected')})` }]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        compact
        label={tr('Agente', 'Agent')}
        value={agent}
        // Outro agente ou outra conta: o modelo e o esforço de antes podem não existir lá.
        onChange={(next) => onChange({ agent: next, model: '', effort: '' })}
      >
        {options.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Select>
      {loading ? (
        <Select compact disabled label={tr('Modelo', 'Model')} value="" onChange={() => {}}>
          <option value="">{tr('Carregando modelos…', 'Loading models…')}</option>
        </Select>
      ) : (
      <Select compact label={tr('Modelo', 'Model')} value={value.model} onChange={(model) => onChange({ model, effort: '' })}>
        {!current && value.model !== '' && <option value={value.model}>{value.model}</option>}
        <option value="">{`${tr('Padrão', 'Default')}${fallback?.resolvedName ? ` (${fallback.resolvedName})` : ''}`}</option>
        {aliases.length > 0 && (
          <optgroup label={tr('Sempre a versão mais nova', 'Always the newest version')}>
            {aliases.map((m) => (
              <option key={m.value} value={m.value}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        )}
        {groupByFamily(versions).map(([family, list]) => (
          <optgroup key={family} label={family}>
            {list.map((m) => (
              <option key={m.value} value={m.value}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      )}
      <Select compact label={tr('Esforço', 'Effort')} disabled={loading || !efforts.length} value={efforts.length ? value.effort : ''} onChange={(effort) => onChange({ effort })}>
        <option value="">Auto</option>
        {efforts.map((e) => (
          <option key={e.value} value={e.value}>
            {e.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
