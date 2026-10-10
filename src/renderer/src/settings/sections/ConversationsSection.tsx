import { EFFORTS, groupByFamily } from '../../conversation/ModelEffortPicker'
import { MODES } from '../../conversation/PermissionModePicker'
import type { SessionSettings } from '../../conversation/SessionSettings'
import { useClaudeInfo } from '../../conversation/useModels'
import { Group, Row, Segmented, Select, Switch } from '../controls'
import { setPreferences, usePreference } from '../preferences'

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
        <Row label="Modelo">
          <Select value={s.model} onChange={(model) => set({ model })}>
            <option value="">Padrão{defaultModel?.resolvedName ? ` - ${defaultModel.resolvedName}` : ''}</option>
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
          label="Esforço"
          description={efforts.length ? 'Quanto o modelo pensa antes de agir. Auto deixa o Claude Code decidir.' : 'O modelo escolhido não usa esforço.'}
        >
          {efforts.length > 0 && (
            <Segmented
              value={s.effort}
              onChange={(effort) => set({ effort })}
              options={[{ value: '', label: 'Auto' }, ...efforts.map((e) => ({ value: e.value, label: e.label }))]}
            />
          )}
        </Row>

        <Row label="Modo" description="Quanto o Claude pode fazer sem pedir sua aprovação.">
          <Select value={s.permissionMode} onChange={(permissionMode) => set({ permissionMode })}>
            <option value="">
              Padrão da conta{info ? ` - ${MODES.find((m) => m.value === info.defaultPermissionMode)?.label ?? ''}` : ''}
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
        <Row label="Thinking" description="Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas.">
          <Switch label="Thinking" checked={s.thinking} onChange={(thinking) => set({ thinking })} />
        </Row>

        <Row label="Ultracode" description="Usa vários subagentes em paralelo em toda tarefa. Gasta bem mais tokens.">
          <Switch label="Ultracode" checked={s.ultracode} onChange={(ultracode) => set({ ultracode })} />
        </Row>
      </Group>
    </>
  )
}
