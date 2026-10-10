import { Group, Row, Segmented, Select } from '../settings/controls'
import { MODELS, TOOLS, type Draft } from './agentDraft'
import { INPUT } from './Field'

// Segundo passo: o modelo e as ferramentas que o agente pode usar.
export function ToolsStep({
  draft,
  onChange,
  onToggleTool
}: {
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
  onToggleTool: (name: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
      <Group>
        <Row label="Modelo" description="Um modelo menor responde mais rápido e gasta menos; um maior pensa melhor.">
          <Select value={draft.model} onChange={(model) => onChange({ model })}>
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Row>
        <Row
          label="Ferramentas"
          description={
            draft.allTools
              ? 'Todas as da conversa, MCPs incluídos (Playwright, Figma...).'
              : 'Só as marcadas abaixo. Menos ferramentas deixa o agente mais focado e mais seguro.'
          }
        >
          <Segmented
            value={draft.allTools ? 'all' : 'some'}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'some', label: 'Só estas' }
            ]}
            onChange={(v) => onChange({ allTools: v === 'all' })}
          />
        </Row>
      </Group>
      {!draft.allTools && (
        <div className="flex flex-col gap-3 rounded-xl bg-fill p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {TOOLS.map((t) => (
              <label key={t.name} className="flex items-center gap-2 text-xs text-text">
                <input type="checkbox" checked={draft.tools.includes(t.name)} onChange={() => onToggleTool(t.name)} />
                {t.label}
                <span className="font-mono text-[11px] text-faint">{t.name}</span>
              </label>
            ))}
          </div>
          <input
            value={draft.extraTools}
            onChange={(e) => onChange({ extraTools: e.target.value })}
            placeholder="Outras, separadas por vírgula: mcp__playwright__browser_navigate, ..."
            spellCheck={false}
            className={`${INPUT} font-mono text-[13px]`}
          />
        </div>
      )}
    </div>
  )
}
