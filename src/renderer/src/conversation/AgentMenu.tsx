import { Bot, FolderOpen } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'

export type AgentMention = { start: number; items: AgentDef[] }

// "@clo" no fim do texto → agentes que começam com "clo". start: onde o @ começa, para trocar
// o pedaço digitado pelo nome inteiro. Nenhum agente com esse começo: sem menu, e o Enter
// continua enviando (um @ qualquer no texto não trava o envio).
export function matchAgents(draft: string, agents: AgentDef[]): AgentMention | null {
  const m = draft.match(/(^|\s)@([\w-]*)$/)
  if (!m || agents.length === 0) return null
  const query = m[2].toLowerCase()
  const items = agents.filter((a) => a.name.startsWith(query))
  return items.length ? { start: draft.length - m[2].length - 1, items } : null
}

// Agentes chamados com @nome no texto enviado.
export function mentionedAgents(text: string, agents: AgentDef[]): AgentDef[] {
  return agents.filter((a) => new RegExp(`(^|\\s)@${a.name}(?![\\w-])`).test(text))
}

// Aviso para o Claude, fora do balão do chat: o nome com @ é pedido para delegar, não só menção.
export function agentHint(called: AgentDef[]): string | undefined {
  if (!called.length) return undefined
  const names = called.map((a) => `"${a.name}"`).join(', ')
  return `<agentes-chamados>A pessoa chamou com @ o(s) agente(s) ${names}. Delegue a tarefa usando a ferramenta Agent com subagent_type igual ao nome do agente, passando no prompt tudo o que ele precisa saber desta conversa.</agentes-chamados>`
}

export function AgentMenu({
  items,
  active,
  onHover,
  onSelect
}: {
  items: AgentDef[]
  active: number
  onHover: (index: number) => void
  onSelect: (agent: AgentDef) => void
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-10 mb-2 rounded-lg border border-line bg-surface p-1 shadow-2xl shadow-black/30">
      {items.map((a, i) => (
        <button
          key={a.path}
          // mousedown: escolher sem tirar o foco do campo de texto
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(a)
          }}
          onMouseEnter={() => onHover(i)}
          className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left ${i === active ? 'bg-surface-2' : ''}`}
        >
          <span className="flex w-40 shrink-0 items-center gap-1.5 self-center text-xs text-text">
            <Bot size={12} className="shrink-0 text-muted" />
            <span className="truncate">@{a.name}</span>
            {a.scope === 'project' && (
              <FolderOpen size={11} className="shrink-0 text-faint" aria-label="Agente deste projeto" />
            )}
          </span>
          <span className="truncate text-[11px] text-faint">{a.description}</span>
        </button>
      ))}
    </div>
  )
}
