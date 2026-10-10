import { Bot, Plus } from 'lucide-react'
import type { AgentDef } from '../../../shared/agents'
import { Button } from '../ui/Button'

// Agentes da biblioteca em cartões; sem nenhum, o que é um agente e o botão de criar.
export function AgentList({ agents, onSelect, onCreate }: { agents: AgentDef[]; onSelect: (a: AgentDef) => void; onCreate: () => void }) {
  if (!agents.length) {
    return (
      <div className="m-auto max-w-sm text-center">
        <p className="text-sm text-text">Nenhum agente ainda</p>
        <p className="mt-1 text-xs leading-relaxed text-faint">
          Um agente é um especialista que você chama em qualquer conversa com @nome, ou que o Claude chama sozinho quando o
          pedido combina com a descrição dele. Vale em todos os projetos.
        </p>
        <Button size="lg" variant="primary" onClick={onCreate} className="mx-auto mt-4">
          <Plus size={12} />
          Criar agente
        </Button>
      </div>
    )
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {agents.map((a) => (
          <button
            key={a.path}
            onClick={() => onSelect(a)}
            className="flex min-h-28 flex-col items-start gap-1.5 rounded-xl border border-line bg-fill p-4 text-left hover:border-line-strong hover:bg-surface-2"
          >
            <span className="flex w-full items-center gap-2 text-[13px] font-medium text-text">
              <Bot size={14} className="shrink-0 text-muted" />
              <span className="truncate">{a.name}</span>
            </span>
            <span className="line-clamp-3 text-[12px] leading-relaxed text-muted">{a.description || 'Sem descrição'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
