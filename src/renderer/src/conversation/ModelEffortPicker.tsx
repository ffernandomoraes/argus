import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronRight, ChevronUp, Workflow } from 'lucide-react'
import type { ClaudeModel } from '../../../shared/models'
import type { SessionSettings } from './SessionSettings'
import { useModels } from './useModels'

// Igual à extensão do VS Code: botão com modelo e esforço embaixo do campo; o menu abre
// para cima com os modelos agrupados por família, a régua de esforço e as opções de
// thinking e Ultracode. A lista de modelos vem do próprio `claude` (ver useModels).

export const EFFORTS = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
  { value: 'xhigh', label: 'Muito alto' },
  { value: 'max', label: 'Máximo' }
]

// Texto da extensão do VS Code para o nível máximo, traduzido.
const MAX_WARNING =
  'Pode gastar tokens demais, com respostas lentas ou pensamento excessivo. Use só nas tarefas mais difíceis.'

const effortLabel = (value: string) => EFFORTS.find((e) => e.value === value)?.label ?? 'Auto'

// "Opus 5.5" → família "Opus". A ordem das famílias segue a ordem da lista do claude.
export function groupByFamily(models: ClaudeModel[]) {
  const families = new Map<string, ClaudeModel[]>()
  for (const m of models) {
    if (m.value === '') continue
    const family = m.displayName.split(' ')[0]
    families.set(family, [...(families.get(family) ?? []), m])
  }
  return [...families.entries()]
}

function EffortDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {EFFORTS.map((_, i) => (
        <span key={i} className={`size-[5px] rounded-full bg-current ${i < level ? '' : 'opacity-20'}`} />
      ))}
    </span>
  )
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  icon
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: ReactNode
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
    >
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-xs text-text">
          {icon}
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-faint">{description}</span>
      </span>
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-text' : 'bg-line-strong'
        }`}
      >
        <span className={`size-3 rounded-full bg-surface transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}

export function ModelEffortPicker({
  settings,
  onChange
}: {
  settings: SessionSettings
  onChange: (patch: Partial<SessionSettings>) => void
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const models = useModels()

  const current = models.find((m) => m.value === settings.model)
  const defaultModel = models.find((m) => m.value === '')
  const families = groupByFamily(models)
  // Padrão mostra o modelo a que aponta hoje: "Opus 5.5".
  const currentName = current
    ? current.value === '' ? (current.resolvedName ?? 'Padrão') : current.displayName
    : settings.model || 'Padrão'
  // Sem lista ainda, mostra a régua inteira; modelo sem esforço (Haiku) esconde a régua.
  const allowed = current ? EFFORTS.filter((e) => current.efforts.includes(e.value)) : EFFORTS
  const index = allowed.findIndex((e) => e.value === settings.effort)
  const dots = EFFORTS.findIndex((e) => e.value === settings.effort) + 1

  useEffect(() => {
    if (!open) return
    setExpanded(null)
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const row = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface-2'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Modelo: ${currentName} · Esforço: ${allowed.length ? effortLabel(settings.effort) : 'não se aplica'}`}
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-text ${
          open ? 'bg-surface-2 text-text' : 'text-muted'
        }`}
      >
        <span>{currentName}</span>
        {allowed.length > 0 && (
          <>
            <EffortDots level={dots} />
            <span className="text-faint">{effortLabel(settings.effort)}</span>
          </>
        )}
        {!settings.thinking && <span className="text-faint">· sem thinking</span>}
        {settings.ultracode && <Workflow size={12} className="text-running" aria-label="Ultracode ligado" />}
        <ChevronUp size={12} className="text-faint" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-72 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/30">
          {/* Sem rolagem aqui: o submenu das versões sai para o lado e seria cortado */}
          <div>
            <div className="px-2 pb-1 pt-1.5 text-[11px] text-faint">Modelo</div>
            {models.length === 0 && <div className="px-2 py-1.5 text-xs text-faint">Carregando modelos…</div>}

            {defaultModel && (
              <button onClick={() => onChange({ model: '' })} className={row}>
                <span className="flex-1">
                  Padrão
                  {defaultModel.resolvedName && <span className="text-faint"> · {defaultModel.resolvedName}</span>}
                </span>
                {settings.model === '' && <Check size={13} className="text-muted" />}
              </button>
            )}

            {families.map(([family, versions]) => {
              const selected = versions.find((v) => v.value === settings.model)
              const isOpen = expanded === family
              return (
                <div
                  key={family}
                  className="relative"
                  onMouseEnter={() => setExpanded(family)}
                  onMouseLeave={() => setExpanded((f) => (f === family ? null : f))}
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : family)}
                    className={`${row} ${isOpen ? 'bg-surface-2' : ''}`}
                  >
                    <span className="flex-1">{family}</span>
                    {selected && <span className="text-[11px] text-faint">{selected.displayName}</span>}
                    {selected && <Check size={13} className="text-muted" />}
                    <ChevronRight size={12} className="shrink-0 text-faint" />
                  </button>
                  {/* Submenu ao lado; o pl-1 mantém o mouse "dentro" ao atravessar o vão */}
                  {isOpen && (
                    <div className="absolute left-full top-0 z-10 pl-1">
                      <div className="w-44 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/30">
                        {versions.map((v) => (
                          <button key={v.value} onClick={() => onChange({ model: v.value })} className={row}>
                            <span className="flex-1">{v.displayName}</span>
                            {settings.model === v.value && <Check size={13} className="text-muted" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {allowed.length > 0 && (
            <>
              <div className="my-1 h-px bg-line" />
              <div className="px-2 pb-2 pt-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-faint">Esforço</span>
                  <span className="text-text">{effortLabel(settings.effort)}</span>
                </div>
                {/* Régua com uma marca por nível aceito; clicar na marca atual volta para Auto */}
                <div className="relative mt-2.5 flex h-4 items-center justify-between">
                  <div className="absolute inset-x-1.5 h-0.5 rounded-full bg-line" />
                  <div
                    className="absolute left-1.5 h-0.5 rounded-full bg-muted"
                    style={{ width: `calc((100% - 12px) * ${Math.max(0, index) / Math.max(1, allowed.length - 1)})` }}
                  />
                  {allowed.map((e, i) => (
                    <button
                      key={e.value}
                      aria-label={e.label}
                      title={e.label}
                      onClick={() => onChange({ effort: settings.effort === e.value ? '' : e.value })}
                      className={`relative size-3 rounded-full border-2 ${
                        i <= index ? 'border-text bg-text' : 'border-line-strong bg-surface hover:border-muted'
                      }`}
                    />
                  ))}
                </div>
                {settings.effort === 'max' && <p className="mt-2 text-[11px] leading-snug text-needs-you">{MAX_WARNING}</p>}
              </div>
            </>
          )}

          <div className="my-1 h-px bg-line" />
          <Toggle
            label="Thinking"
            description="Pensa antes de responder. Respostas melhores em tarefas difíceis, um pouco mais lentas."
            checked={settings.thinking}
            onChange={(thinking) => onChange({ thinking })}
          />
          <Toggle
            label="Ultracode"
            icon={<Workflow size={12} />}
            description="Usa vários subagentes em paralelo em toda tarefa, só nesta sessão. Gasta bem mais tokens."
            checked={settings.ultracode}
            onChange={(ultracode) => onChange({ ultracode })}
          />
        </div>
      )}
    </div>
  )
}
