import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Bot, Plus, Trash2, X } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { useEscape } from '../useEscape'
import { IS_WIN, isMod, keys, tildify } from '../platform'
import { Group, Row, Segmented, Select } from '../settings/controls'

// Ferramentas do Claude Code que dá para marcar uma a uma. Outras (MCPs, por exemplo) vão no
// campo de texto, pelo nome completo.
const TOOLS = [
  { name: 'Read', label: 'Ler arquivos' },
  { name: 'Grep', label: 'Buscar no código' },
  { name: 'Glob', label: 'Procurar arquivos' },
  { name: 'Edit', label: 'Editar' },
  { name: 'Write', label: 'Criar arquivos' },
  { name: 'Bash', label: 'Rodar comandos' },
  { name: 'WebFetch', label: 'Abrir páginas' },
  { name: 'WebSearch', label: 'Pesquisar na web' },
  { name: 'TodoWrite', label: 'Lista de tarefas' },
  { name: 'Skill', label: 'Usar skills' }
]
const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))

const MODELS = [
  { value: '', label: 'O mesmo da conversa' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' }
]

// Criar um agente vai passo a passo; um agente salvo abre com os passos livres, como abas.
const STEPS = ['Instruções', 'Ferramentas e modelo']
const LAST_STEP = STEPS.length - 1

type Draft = {
  name: string
  description: string
  prompt: string
  model: string
  allTools: boolean
  tools: string[]
  // Ferramentas fora da lista, separadas por vírgula.
  extraTools: string
  // Nome salvo no disco; vazio = agente novo.
  previousName?: string
}

const EMPTY: Draft = { name: '', description: '', prompt: '', model: '', allTools: true, tools: [], extraTools: '' }

function toDraft(a: AgentDef): Draft {
  const tools = a.tools ?? []
  return {
    name: a.name,
    description: a.description,
    prompt: a.prompt,
    model: a.model ?? '',
    allTools: !a.tools,
    tools: tools.filter((t) => TOOL_NAMES.has(t)),
    extraTools: tools.filter((t) => !TOOL_NAMES.has(t)).join(', '),
    previousName: a.name
  }
}

function toolList(d: Draft): string[] | undefined {
  if (d.allTools) return undefined
  const extra = d.extraTools
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  return [...d.tools, ...extra]
}

// Campos obrigatórios ainda vazios, com o nome que aparece na tela.
function missing(d: Draft): string[] {
  return [!d.name.trim() && 'nome', !d.description.trim() && 'quando usar', !d.prompt.trim() && 'instruções'].filter(
    (m): m is string => !!m
  )
}

function Field({
  label,
  hint,
  className = '',
  children
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-text">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
    </label>
  )
}

// Abas do agente. No agente novo, a seguinte só abre depois desta.
function StepTabs({ step, reached, onGo }: { step: number; reached: number; onGo: (step: number) => void }) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-line px-5">
      {STEPS.map((label, i) => {
        const active = i === step
        const enabled = i <= reached
        return (
          <button
            key={label}
            role="tab"
            aria-selected={active}
            disabled={!enabled}
            onClick={() => onGo(i)}
            title={enabled ? undefined : 'Preencha as instruções primeiro'}
            className={`-mb-px border-b-2 py-2.5 text-[13px] ${
              active
                ? 'border-accent font-medium text-text'
                : enabled
                  ? 'border-transparent text-muted hover:text-text'
                  : 'border-transparent text-faint'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const input =
  'rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-faint focus:border-line-strong'
const PRIMARY =
  'flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-40'
const SECONDARY =
  'flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-fill disabled:opacity-40'
const GHOST = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-fill hover:text-text'

// Biblioteca de agentes globais: os arquivos de ~/.claude/agents, que valem em todo projeto
// (aqui, no terminal e no VS Code). O app só lê e grava esses arquivos.
export function AgentsModal({ onClose }: { onClose: () => void }) {
  const [agents, setAgents] = useState<AgentDef[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  // Como o rascunho estava ao abrir: compara para saber se há mudança.
  const [saved, setSaved] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  // Até onde o agente novo já chegou: os passos seguintes ficam travados.
  const [reached, setReached] = useState(0)
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved)
  const current = agents.find((a) => a.name === draft?.previousName)
  const lacking = draft ? missing(draft) : []
  const canSave = dirty && !lacking.length

  const reload = async () => {
    const list = await window.api.agents.list()
    setAgents(list)
    setLoaded(true)
    return list
  }

  useEffect(() => {
    void reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDiscard = () => !dirty || window.confirm('Descartar as alterações deste agente?')

  const open = (d: Draft, base: Draft | null = d) => {
    const existing = !!d.previousName
    setDraft(d)
    setSaved(base)
    setError(null)
    setStep(0)
    setReached(existing ? LAST_STEP : 0)
  }

  const go = (to: number) => {
    setStep(to)
    setReached((r) => Math.max(r, to))
  }

  const select = (a: AgentDef) => open(toDraft(a))
  const create = () => open({ ...EMPTY }, null)

  // Volta para a lista de agentes.
  const back = () => {
    if (!confirmDiscard()) return
    setDraft(null)
    setSaved(null)
    setError(null)
  }

  const save = async () => {
    if (!draft || !canSave) return
    const r = await window.api.agents.save({
      name: draft.name,
      description: draft.description,
      prompt: draft.prompt,
      model: draft.model || undefined,
      tools: toolList(draft),
      previousName: draft.previousName
    })
    if (!r.ok) return setError(r.error)
    await reload()
    // Continua no passo em que estava.
    setDraft(toDraft(r.agent))
    setSaved(toDraft(r.agent))
    setReached(LAST_STEP)
    setError(null)
  }

  const remove = async () => {
    if (!draft?.previousName) return
    if (!window.confirm(`Excluir o agente ${draft.previousName}? O arquivo dele é apagado.`)) return
    await window.api.agents.remove(draft.previousName)
    await reload()
    setDraft(null)
    setSaved(null)
    setError(null)
  }

  const close = () => confirmDiscard() && onClose()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isMod(e) && e.key === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  // ESC volta uma camada: do agente aberto para a lista, depois fecha a janela.
  useEscape(() => {
    if (draft) back()
    else close()
  })

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch })
  const toggleTool = (name: string) =>
    draft && set({ tools: draft.tools.includes(name) ? draft.tools.filter((t) => t !== name) : [...draft.tools, name] })

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-label="Agentes"
        className="flex h-[min(760px,100%)] w-[min(1040px,100%)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-3">
            {draft ? (
              <button
                onClick={back}
                aria-label="Voltar para os agentes"
                title="Voltar para os agentes"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              >
                <ArrowLeft size={15} />
              </button>
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center text-muted">
                <Bot size={16} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{draft ? draft.previousName ?? 'Novo agente' : 'Agentes'}</div>
              <div className="mt-0.5 truncate font-mono text-[12px] text-faint">
                {current ? tildify(current.path) : IS_WIN ? '~\\.claude\\agents\\' : '~/.claude/agents/'}
              </div>
            </div>
            {!draft && loaded && agents.length > 0 && (
              <button onClick={create} className={PRIMARY}>
                <Plus size={12} />
                Novo agente
              </button>
            )}
            {draft?.previousName && (
              <button
                onClick={() => void remove()}
                title="Excluir"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
              >
                <Trash2 size={12} />
                Excluir
              </button>
            )}
            <button
              aria-label="Fechar"
              title="Fechar"
              onClick={close}
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
            >
              <X size={15} />
            </button>
          </header>

          {!draft ? (
            loaded &&
            (agents.length ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {agents.map((a) => (
                    <button
                      key={a.path}
                      onClick={() => select(a)}
                      className="flex min-h-28 flex-col items-start gap-1.5 rounded-xl border border-line bg-fill p-4 text-left hover:border-line-strong hover:bg-surface-2"
                    >
                      <span className="flex w-full items-center gap-2 text-[13px] font-medium text-text">
                        <Bot size={14} className="shrink-0 text-muted" />
                        <span className="truncate">{a.name}</span>
                      </span>
                      <span className="line-clamp-3 text-[12px] leading-relaxed text-muted">
                        {a.description || 'Sem descrição'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="m-auto max-w-sm text-center">
                <p className="text-sm text-text">Nenhum agente ainda</p>
                <p className="mt-1 text-xs leading-relaxed text-faint">
                  Um agente é um especialista que você chama em qualquer conversa com @nome, ou que o Claude chama
                  sozinho quando o pedido combina com a descrição dele. Vale em todos os projetos.
                </p>
                <button onClick={create} className={`${PRIMARY} mx-auto mt-4`}>
                  <Plus size={12} />
                  Criar agente
                </button>
              </div>
            ))
          ) : (
            <>
              <StepTabs step={step} reached={reached} onGo={go} />
              {error && <p className="border-b border-line px-5 py-2 text-xs text-red-400">{error}</p>}

              {step === 0 && (
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
                  <Field label="Nome" hint="Letras minúsculas, números e hífen. É como você chama no chat: @nome.">
                    <input
                      value={draft.name}
                      onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="revisor-de-telas"
                      spellCheck={false}
                      autoFocus={!draft.name}
                      className={`${input} font-mono`}
                    />
                  </Field>
                  <Field
                    label="Quando usar"
                    hint="O Claude lê isto para decidir sozinho se chama este agente. Diga a tarefa e quando ela aparece."
                  >
                    <textarea
                      value={draft.description}
                      onChange={(e) => set({ description: e.target.value })}
                      rows={2}
                      placeholder="Revisa telas novas comparando com o Figma. Use depois de implementar ou alterar uma tela."
                      className={`${input} resize-none`}
                    />
                  </Field>
                  <Field
                    label="Instruções"
                    hint="O que o agente sabe e como trabalha, passo a passo. Ele não vê a conversa: só o pedido que recebe."
                    className="min-h-72 flex-1"
                  >
                    <textarea
                      value={draft.prompt}
                      onChange={(e) => set({ prompt: e.target.value })}
                      placeholder={
                        'Você revisa telas recém-implementadas no projeto atual.\n\n1. Leia o projeto: stack, componentes e tokens existentes.\n2. Abra a tela no navegador e tire prints.\n3. ...'
                      }
                      className={`${input} flex-1 resize-none text-[14px] leading-relaxed`}
                    />
                  </Field>
                </div>
              )}

              {step === 1 && (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
                  <Group>
                    <Row label="Modelo" description="Um modelo menor responde mais rápido e gasta menos; um maior pensa melhor.">
                      <Select value={draft.model} onChange={(model) => set({ model })}>
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
                        onChange={(v) => set({ allTools: v === 'all' })}
                      />
                    </Row>
                  </Group>
                  {!draft.allTools && (
                    <div className="flex flex-col gap-3 rounded-xl bg-fill p-4">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {TOOLS.map((t) => (
                          <label key={t.name} className="flex items-center gap-2 text-xs text-text">
                            <input type="checkbox" checked={draft.tools.includes(t.name)} onChange={() => toggleTool(t.name)} />
                            {t.label}
                            <span className="font-mono text-[11px] text-faint">{t.name}</span>
                          </label>
                        ))}
                      </div>
                      <input
                        value={draft.extraTools}
                        onChange={(e) => set({ extraTools: e.target.value })}
                        placeholder="Outras, separadas por vírgula: mcp__playwright__browser_navigate, ..."
                        spellCheck={false}
                        className={`${input} font-mono text-[13px]`}
                      />
                    </div>
                  )}
                </div>
              )}

              <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
                {/* Na primeira aba, Voltar leva de volta para a lista de agentes. */}
                <button onClick={() => (step > 0 ? go(step - 1) : back())} className={GHOST}>
                  <ArrowLeft size={12} />
                  Voltar
                </button>
                <span className="flex-1" />
                {lacking.length > 0 && <span className="text-[12px] text-faint">Falta preencher: {lacking.join(', ')}</span>}
                <button
                  onClick={() => void save()}
                  disabled={!canSave}
                  title={lacking.length ? `Falta preencher: ${lacking.join(', ')}` : `Salvar (${keys('⌘S')})`}
                  className={step < LAST_STEP ? SECONDARY : PRIMARY}
                >
                  {draft.previousName && !dirty ? 'Salvo' : 'Salvar'}
                </button>
                {step < LAST_STEP && (
                  <button onClick={() => go(step + 1)} disabled={lacking.length > 0} className={PRIMARY}>
                    Continuar
                    <ArrowRight size={12} />
                  </button>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
