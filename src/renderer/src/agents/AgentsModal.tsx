import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bot, Copy, Loader2, Mic, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useDictation } from '../conversation/useDictation'
import { VoiceWave } from '../conversation/VoiceWave'
import type { AgentDef } from '../../../shared/agents'
import { useEscape } from '../useEscape'
import { IS_WIN, isMod, keys, tildify } from '../platform'

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

// Campos que aceitam ditado: a descrição para o Claude preencher e os textos do agente.
type VoiceTarget = 'brief' | 'description' | 'prompt'

function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={listening ? 'Parar ditado' : 'Ditar por voz'}
      title={listening ? 'Parar ditado' : 'Ditar por voz'}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`flex size-6 items-center justify-center rounded-md ${
        listening ? 'bg-running/15 text-running hover:bg-running/25' : 'text-muted hover:bg-surface-2 hover:text-text'
      }`}
    >
      <Mic size={13} />
    </button>
  )
}

function Field({ label, hint, action, children }: { label: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-text">
        {label}
        {action}
      </span>
      {children}
      {hint && <span className="text-[11px] leading-snug text-faint">{hint}</span>}
    </label>
  )
}

const input =
  'rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-faint focus:border-line-strong'

// Biblioteca de agentes globais: os arquivos de ~/.claude/agents, que valem em todo projeto
// (aqui, no terminal e no VS Code). O app só lê e grava esses arquivos.
export function AgentsModal({ onClose }: { onClose: () => void }) {
  const [agents, setAgents] = useState<AgentDef[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  // Como o rascunho estava ao abrir: compara para saber se há mudança.
  const [saved, setSaved] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Descrição livre (falada ou escrita) que o Claude transforma nos campos.
  const [brief, setBrief] = useState('')
  const [drafting, setDrafting] = useState(false)

  // Ditado vai para um campo por vez: o texto falado entra depois do que já estava nele.
  const voiceTarget = useRef<VoiceTarget | null>(null)
  const [listeningTo, setListeningTo] = useState<VoiceTarget | null>(null)
  const voiceBase = useRef('')
  const dictation = useDictation((spoken) => {
    const target = voiceTarget.current
    if (!target) return
    const base = voiceBase.current
    const value = base && spoken ? `${base.trimEnd()} ${spoken}` : base + spoken
    if (target === 'brief') setBrief(value)
    else setDraft((d) => d && { ...d, [target]: value })
  })
  const listening = dictation.state !== 'idle'
  useEffect(() => {
    if (!listening) setListeningTo(null)
  }, [listening])

  const toggleVoice = (target: VoiceTarget, current: string) => {
    if (listening) {
      dictation.stop(true)
      // Outro campo: o próximo clique liga nele.
      return
    }
    voiceTarget.current = target
    voiceBase.current = current
    setListeningTo(target)
    dictation.start()
  }

  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved)
  const current = agents.find((a) => a.name === draft?.previousName)

  const reload = async () => {
    const list = await window.api.agents.list()
    setAgents(list)
    setLoaded(true)
    return list
  }

  useEffect(() => {
    reload().then((list) => {
      if (list[0]) open(toDraft(list[0]))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDiscard = () => !dirty || window.confirm('Descartar as alterações deste agente?')

  const open = (d: Draft, base: Draft | null = d) => {
    if (listening) dictation.stop()
    setDraft(d)
    setSaved(base)
    setError(null)
    setBrief('')
  }

  // O Claude preenche os campos com o que você contou. Agente com conteúdo: vale como ajuste.
  const fill = async () => {
    if (!draft || !brief.trim() || drafting) return
    setDrafting(true)
    setError(null)
    const r = await window.api.agents.draft({
      brief,
      current: { name: draft.name, description: draft.description, prompt: draft.prompt, model: draft.model || undefined }
    })
    setDrafting(false)
    if (!r.ok) return setError(r.error)
    setDraft((d) =>
      d && {
        ...d,
        // Agente já salvo mantém o nome: renomear muda o @ que você usa.
        name: d.previousName ? d.name : r.fields.name,
        description: r.fields.description,
        prompt: r.fields.prompt,
        model: r.fields.model ?? ''
      }
    )
    setBrief('')
  }

  // Agente novo já ouvindo: é só contar o que ele faz.
  const createByVoice = () => {
    if (!confirmDiscard()) return
    open({ ...EMPTY }, null)
    voiceTarget.current = 'brief'
    voiceBase.current = ''
    setListeningTo('brief')
    dictation.start()
  }

  const select = (a: AgentDef) => confirmDiscard() && open(toDraft(a))
  const create = () => confirmDiscard() && open({ ...EMPTY }, null)
  const duplicate = () => {
    if (!draft || !confirmDiscard()) return
    open({ ...draft, name: `${draft.name}-copia`, previousName: undefined }, null)
  }

  const save = async () => {
    if (!draft || !dirty) return
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
    open(toDraft(r.agent))
  }

  const remove = async () => {
    if (!draft?.previousName) return
    if (!window.confirm(`Excluir o agente ${draft.previousName}? O arquivo dele é apagado.`)) return
    await window.api.agents.remove(draft.previousName)
    const list = await reload()
    if (list[0]) open(toDraft(list[0]))
    else {
      setDraft(null)
      setSaved(null)
    }
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
  useEscape(() => {
    if (listening) dictation.stop(true)
    else close()
  })

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch })
  const toggleTool = (name: string) =>
    draft && set({ tools: draft.tools.includes(name) ? draft.tools.filter((t) => t !== name) : [...draft.tools, name] })

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-label="Agentes"
        className="flex h-[min(720px,100%)] w-[min(980px,100%)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <nav className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-2/40 p-3">
          <div className="mb-3 flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
            <Bot size={15} />
            Agentes
          </div>
          <div className="mb-3 flex gap-1.5">
            <button
              onClick={create}
              className="flex flex-1 items-center gap-2 rounded-md border border-line px-2 py-1.5 text-xs text-text hover:bg-surface-2"
            >
              <Plus size={13} />
              Novo agente
            </button>
            <button
              onClick={createByVoice}
              aria-label="Novo agente por voz"
              title="Novo agente por voz: conte o que ele faz"
              className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-line text-text hover:bg-surface-2"
            >
              <Mic size={13} />
            </button>
          </div>
          {agents.map((a) => (
            <button
              key={a.path}
              onClick={() => select(a)}
              title={a.description}
              className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left ${
                draft?.previousName === a.name ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
              }`}
            >
              <span className="w-full truncate text-xs">{a.name}</span>
              <span className="w-full truncate text-[10px] text-faint">{a.description}</span>
            </button>
          ))}
          {draft && !draft.previousName && (
            <div className="flex w-full flex-col items-start rounded-md bg-surface-2 px-2 py-1.5 text-xs italic text-text">
              {draft.name || 'novo agente'}
            </div>
          )}
        </nav>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {draft ? draft.previousName ?? 'Novo agente' : 'Agentes globais'}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
                {current ? tildify(current.path) : IS_WIN ? '~\\.claude\\agents\\' : '~/.claude/agents/'}
              </div>
            </div>
            {draft?.previousName && (
              <>
                <button
                  onClick={duplicate}
                  title="Duplicar"
                  className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-text hover:bg-surface-2"
                >
                  <Copy size={12} />
                  Duplicar
                </button>
                <button
                  onClick={() => void remove()}
                  title="Excluir"
                  className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </>
            )}
            {draft && (
              <button
                onClick={() => void save()}
                disabled={!dirty}
                title={`Salvar (${keys('⌘S')})`}
                className="rounded-md bg-text px-2.5 py-1 text-xs font-medium text-bg hover:opacity-85 disabled:opacity-40"
              >
                Salvar
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

          {error && <p className="border-b border-line px-5 py-2 text-xs text-red-400">{error}</p>}

          {!draft ? (
            loaded && (
              <div className="m-auto max-w-sm text-center">
                <p className="text-sm text-text">Nenhum agente ainda</p>
                <p className="mt-1 text-xs leading-relaxed text-faint">
                  Um agente é um especialista que você chama em qualquer conversa com @nome, ou que o Claude chama
                  sozinho quando o pedido combina com a descrição dele. Vale em todos os projetos.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={createByVoice}
                    className="flex items-center gap-1.5 rounded-md bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-85"
                  >
                    <Mic size={12} />
                    Criar por voz
                  </button>
                  <button
                    onClick={create}
                    className="rounded-md border border-line px-3 py-1.5 text-xs text-text hover:bg-surface-2"
                  >
                    Preencher à mão
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/60 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-text">
                  <Sparkles size={13} className="shrink-0" />
                  {draft.description || draft.prompt ? 'Ajustar com o Claude' : 'Descreva o agente e o Claude preenche'}
                </div>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isMod(e)) {
                      e.preventDefault()
                      void fill()
                    }
                  }}
                  rows={3}
                  placeholder={
                    listeningTo === 'brief'
                      ? 'Ouvindo… conte o que ele faz, como trabalha e o que entrega'
                      : draft.description || draft.prompt
                        ? 'O que mudar? Ex.: "ele também deve conferir a versão mobile"'
                        : 'Fale ou escreva: o que ele faz, como trabalha, que ferramentas usa e o que entrega.'
                  }
                  className={`${input} resize-none text-[13px]`}
                />
                <div className="flex items-center gap-2">
                  <MicButton listening={listeningTo === 'brief'} onClick={() => toggleVoice('brief', brief)} />
                  {listeningTo === 'brief' && <VoiceWave />}
                  {dictation.error && <span className="truncate text-[11px] text-red-400">{dictation.error.message}</span>}
                  <span className="flex-1" />
                  <button
                    onClick={() => void fill()}
                    disabled={!brief.trim() || drafting || listening}
                    title={listening ? 'Pare o microfone para preencher' : `Preencher os campos (${keys('⌘Enter')})`}
                    className="flex items-center gap-1.5 rounded-md bg-text px-2.5 py-1 text-xs font-medium text-bg hover:opacity-85 disabled:opacity-40"
                  >
                    {drafting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {drafting ? 'Escrevendo…' : draft.description || draft.prompt ? 'Ajustar campos' : 'Preencher campos'}
                  </button>
                </div>
              </div>

              <Field label="Nome" hint="Letras minúsculas, números e hífen. É como você chama no chat: @nome.">
                <input
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="clone-de-paginas"
                  spellCheck={false}
                  className={`${input} font-mono`}
                />
              </Field>

              <Field
                label="Quando usar"
                hint="O Claude lê isto para decidir sozinho se chama este agente. Diga a tarefa e quando ela aparece."
                action={
                  <MicButton
                    listening={listeningTo === 'description'}
                    onClick={() => toggleVoice('description', draft.description)}
                  />
                }
              >
                <input
                  value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Clona uma página de referência no padrão e na stack do projeto, comparando por prints."
                  className={input}
                />
              </Field>

              <Field
                label="Instruções"
                hint="O que o agente sabe e como trabalha, passo a passo. Ele não vê a conversa: só o pedido que recebe."
                action={<MicButton listening={listeningTo === 'prompt'} onClick={() => toggleVoice('prompt', draft.prompt)} />}
              >
                <textarea
                  value={draft.prompt}
                  onChange={(e) => set({ prompt: e.target.value })}
                  rows={14}
                  spellCheck={false}
                  placeholder={'Você clona páginas da web dentro do projeto atual.\n\n1. Abra a referência e tire prints de cada seção.\n2. Leia o projeto: stack, componentes e tokens existentes.\n3. ...'}
                  className={`${input} min-h-56 resize-y font-mono text-[12px] leading-relaxed`}
                />
              </Field>

              <Field label="Modelo">
                <select value={draft.model} onChange={(e) => set({ model: e.target.value })} className={`${input} w-56`}>
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-text">Ferramentas</span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="radio" checked={draft.allTools} onChange={() => set({ allTools: true })} />
                  Todas as da conversa, MCPs incluídos (Playwright, Figma...)
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="radio" checked={!draft.allTools} onChange={() => set({ allTools: false })} />
                  Só estas
                </label>
                {!draft.allTools && (
                  <div className="ml-5 flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {TOOLS.map((t) => (
                        <label key={t.name} className="flex items-center gap-2 text-xs text-text">
                          <input type="checkbox" checked={draft.tools.includes(t.name)} onChange={() => toggleTool(t.name)} />
                          {t.label}
                          <span className="font-mono text-[10px] text-faint">{t.name}</span>
                        </label>
                      ))}
                    </div>
                    <input
                      value={draft.extraTools}
                      onChange={(e) => set({ extraTools: e.target.value })}
                      placeholder="Outras, separadas por vírgula: mcp__playwright__browser_navigate, ..."
                      spellCheck={false}
                      className={`${input} font-mono text-[12px]`}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
