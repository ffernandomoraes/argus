import type { ActiveChat, ChatState } from '@argus/shared/chat';
import { tr } from '../i18n';

// A conversa já respondeu e só o que ela deixou em segundo plano (subagente, servidor...) a mantém
// em andamento: aparece concluída, com o que roda embaixo. O Argus antigo não manda turnDone: vale
// o mesmo sinal de antes (rodando, sem pedido em curso e com algo em segundo plano).
export function isTurnDone(chat: ActiveChat): boolean {
  return chat.turnDone ?? (!chat.turnStartedAt && chat.status === 'running' && chat.background > 0);
}

// "1 subagente e 2 tarefas", para a linha em cima da caixa de escrever.
export function backgroundCount(agents: number, tasks: number): string {
  const a = agents && tr(`${agents} subagente${agents > 1 ? 's' : ''}`, `${agents} subagent${agents > 1 ? 's' : ''}`);
  const t = tasks && tr(`${tasks} tarefa${tasks > 1 ? 's' : ''}`, `${tasks} task${tasks > 1 ? 's' : ''}`);
  return [a, t].filter(Boolean).join(tr(' e ', ' and '));
}

// Subagente ou tarefa ainda rodando em segundo plano na conversa aberta.
export const hasBackground = (state: ChatState): boolean => state.backgroundTasks + state.agents.filter((a) => a.background).length > 0;
