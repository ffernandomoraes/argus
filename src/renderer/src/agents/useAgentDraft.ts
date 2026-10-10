import { useEffect, useRef, useState } from 'react'
import type { AgentDef } from '../../../shared/agents'
import { EMPTY_DRAFT, LAST_STEP, missing, sameDraft, toDraft, toggleTool, toSaveRequest, type Draft } from './agentDraft'

// A biblioteca de agentes e o agente aberto: o rascunho, como ele estava ao abrir (para saber se
// há mudança), o passo em que está e até onde o agente novo já chegou.
export function useAgentDraft() {
  const [agents, setAgents] = useState<AgentDef[]>([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saved, setSaved] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  // Até onde o agente novo já chegou: os passos seguintes ficam travados.
  const [reached, setReached] = useState(0)
  // Gravando: um segundo ⌘S antes de a tela mostrar o agente salvo gravaria de novo como agente
  // novo e daria o erro falso "Já existe um agente".
  const saving = useRef(false)

  const dirty = !!draft && !sameDraft(draft, saved)
  const current = agents.find((a) => a.name === draft?.previousName)
  const lacking = draft ? missing(draft) : []
  const canSave = dirty && !lacking.length

  const reload = async () => {
    const list = await window.api.agents.list()
    setAgents(list)
    setLoaded(true)
  }

  useEffect(() => {
    let alive = true
    window.api.agents.list().then(
      (list) => {
        if (!alive) return
        setAgents(list)
        setLoaded(true)
      },
      (err: unknown) => console.error('[agentes] listar:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  // A trava de gravação sai quando a tela já mostra o agente salvo.
  useEffect(() => {
    saving.current = false
  }, [saved])

  const open = (d: Draft, base: Draft | null = d) => {
    setDraft(d)
    setSaved(base)
    setError(null)
    setStep(0)
    setReached(d.previousName ? LAST_STEP : 0)
  }

  const go = (to: number) => {
    setStep(to)
    setReached((r) => Math.max(r, to))
  }

  // Volta para a lista de agentes (quem chama pergunta antes de descartar).
  const close = () => {
    setDraft(null)
    setSaved(null)
    setError(null)
  }

  const save = async () => {
    if (!draft || !canSave || saving.current) return
    saving.current = true
    const r = await window.api.agents.save(toSaveRequest(draft)).catch((err: unknown) => ({ ok: false as const, error: String(err) }))
    if (!r.ok) {
      saving.current = false
      return setError(r.error)
    }
    await reload().catch((err: unknown) => console.error('[agentes] listar:', err))
    // Continua no passo em que estava.
    setDraft(toDraft(r.agent))
    setSaved(toDraft(r.agent))
    setReached(LAST_STEP)
    setError(null)
  }

  const remove = async () => {
    if (!draft?.previousName) return
    await window.api.agents.remove(draft.previousName)
    await reload()
    close()
  }

  return {
    agents,
    loaded,
    draft,
    error,
    step,
    reached,
    dirty,
    current,
    lacking,
    canSave,
    select: (a: AgentDef) => open(toDraft(a)),
    create: () => open({ ...EMPTY_DRAFT }, null),
    go,
    close,
    save,
    remove,
    set: (patch: Partial<Draft>) => setDraft((d) => d && { ...d, ...patch }),
    toggleTool: (name: string) => setDraft((d) => d && toggleTool(d, name))
  }
}
