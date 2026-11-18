import type { ChatState } from './chat';

// Trocar a conta de uma conversa do Claude com a sessão aberta encerra a sessão na hora, e a próxima
// mensagem abre de novo na conta nova, retomando a mesma conversa: ela nunca segue gastando a conta
// de antes. O que estiver em andamento para junto; a tela lista o quê antes de trocar.

// Uma linha do aviso, em português e em inglês (cada app escolhe com o tr dele).
export type SwitchStop = [pt: string, en: string];

// pt/en: [com um só (já com o artigo), com vários (o número vem na frente)].
const count = (n: number, pt: [string, string], en: [string, string]): SwitchStop =>
  n === 1 ? [pt[0], en[0]] : [`${n} ${pt[1]}`, `${n} ${en[1]}`];

// O que para se a conta trocar agora. Vazio: nada em andamento, troca sem perguntar.
export function accountSwitchStops(state: ChatState | null | undefined): SwitchStop[] {
  if (!state) return [];
  const stops: SwitchStop[] = [];
  const agents = state.agents.length;
  const background = state.backgroundTasks;
  // Trabalhando sem pedido em andamento são só os subagentes e comandos, que vêm nas linhas abaixo.
  if (state.status === 'running' && (state.turnStartedAt || (!agents && !background)))
    stops.push(['o pedido em andamento', 'the request in progress']);
  if (state.status === 'needs-you') stops.push(['o pedido que espera a sua resposta', 'the request waiting for your answer']);
  if (agents) stops.push(count(agents, ['um subagente', 'subagentes'], ['one subagent', 'subagents']));
  if (background)
    stops.push(count(background, ['um comando em segundo plano', 'comandos em segundo plano'], ['one background command', 'background commands']));
  const queued = state.queued?.length ?? 0;
  if (queued)
    stops.push(count(queued, ['uma mensagem na fila, que não será enviada', 'mensagens na fila, que não serão enviadas'], ['one queued message, which won’t be sent', 'queued messages, which won’t be sent']));
  if (state.remote && state.remote.status !== 'failed')
    stops.push(['o controle remoto (claude.ai e celular), que fica desligado', 'remote control (claude.ai and phone), which stays off']);
  return stops;
}

// "a, b e c" ou "a, b and c".
export function joinStops(items: string[], and: string): string {
  return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
