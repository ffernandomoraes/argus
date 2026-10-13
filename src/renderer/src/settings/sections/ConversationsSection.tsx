import { EFFORTS, groupByFamily } from '../../conversation/ModelEffortPicker'
import { MODES } from '../../conversation/PermissionModePicker'
import type { SessionSettings } from '../../conversation/SessionSettings'
import { useClaudeInfo } from '../../conversation/useModels'
import { Group, Row, Segmented, Select, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

export function ConversationsSection() {
  const s = usePreference('conversation')
  const info = useClaudeInfo()
  const models = info?.models ?? []
  const set = (patch: Partial<SessionSettings>) => setPreferences({ conversation: { ...s, ...patch } })

  const defaultModel = models.find((m) => m.value === '')
  const current = models.find((m) => m.value === s.model)
  const efforts = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS

  return (
    <>
      <Group>
        <Row label={tr('Modelo', 'Model')}>
          <Select value={s.model} onChange={(model) => set({ model })}>
            <option value="">
              {tr('Padrão', 'Default')}
              {defaultModel?.resolvedName ? ` - ${defaultModel.resolvedName}` : ''}
            </option>
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

        <Row
          label={tr('Esforço', 'Effort')}
          description={
            efforts.length
              ? tr('Quanto o modelo pensa antes de agir. Auto deixa o Claude Code decidir.', 'How much the model thinks before acting. Auto lets Claude Code decide.')
              : tr('O modelo escolhido não usa esforço.', 'The selected model does not use effort.')
          }
        >
          {efforts.length > 0 && (
            <Segmented
              value={s.effort}
              onChange={(effort) => set({ effort })}
              options={[{ value: '', label: 'Auto' }, ...efforts.map((e) => ({ value: e.value, label: e.label }))]}
            />
          )}
        </Row>

        <Row label={tr('Modo', 'Mode')} description={tr('Quanto o Claude pode fazer sem pedir sua aprovação.', 'How much Claude can do without asking for your approval.')}>
          <Select value={s.permissionMode} onChange={(permissionMode) => set({ permissionMode })}>
            <option value="">
              {tr('Padrão da conta', 'Account default')}
              {info ? ` - ${MODES.find((m) => m.value === info.defaultPermissionMode)?.label ?? ''}` : ''}
            </option>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Row>
      </Group>

      <Group>
        <Row label="Thinking" description={tr(
            'Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas.',
            'Thinks before answering. Better answers on hard tasks, a bit slower.'
          )}>
          <Switch label="Thinking" checked={s.thinking} onChange={(thinking) => set({ thinking })} />
        </Row>

        <Row label="Ultracode" description={tr('Usa vários subagentes em paralelo em toda tarefa. Gasta bem mais tokens.', 'Uses several subagents in parallel on every task. Uses many more tokens.')}>
          <Switch label="Ultracode" checked={s.ultracode} onChange={(ultracode) => set({ ultracode })} />
        </Row>
      </Group>
    </>
  )
}
