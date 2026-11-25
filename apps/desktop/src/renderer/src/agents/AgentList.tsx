import { Bot, Plus } from 'lucide-react';
import { agentProviderName, type AgentDef, type AgentProvider } from '@argus/shared/agents';
import { Button } from '../ui/Button';
import { tr } from '../i18n';
import { EmptyState } from '../ui/emptyState/EmptyState';
import { AgentsArt } from '../ui/emptyState/illustrations';

// Agentes da biblioteca em cartões; sem nenhum, o que é um agente e o botão de criar.
export function AgentList({
  provider,
  agents,
  onSelect,
  onCreate,
}: {
  provider: AgentProvider
  agents: AgentDef[]
  onSelect: (a: AgentDef) => void
  onCreate: () => void
}) {
  if (!agents.length) {
    const name = agentProviderName(provider);
    return (
      <EmptyState
        size="sm"
        art={<AgentsArt />}
        title={tr('Nenhum agente ainda', 'No agents yet')}
        text={
          provider === 'cursor'
            ? tr(
                'Um agente é um especialista que você chama com @nome nas conversas com o Cursor: as instruções dele vão junto da mensagem. Vale em todos os projetos.',
                'An agent is a specialist you call with @name in chats with Cursor: its instructions go along with your message. It works in every project.',
              )
            : tr(
                `Um agente é um especialista que você chama com @nome nas conversas com o ${name}, ou que o ${name} chama sozinho quando o pedido combina com a descrição dele. Vale em todos os projetos.`,
                `An agent is a specialist you call with @name in chats with ${name}, or that ${name} calls on its own when the request matches its description. It works in every project.`,
              )
        }
      >
        <Button size="lg" variant="primary" onClick={onCreate}>
          <Plus size={12} />
          {tr('Criar agente', 'Create agent')}
        </Button>
      </EmptyState>
    );
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
            <span className="line-clamp-3 text-[12px] leading-relaxed text-muted">{a.description || tr('Sem descrição', 'No description')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
