import { parseAgentRef } from '@argus/shared/providers';
import { resolveAccount } from '../accounts';
import type { AgentChatSession } from '../agentChats/session';
import { ChatSession } from './session';

// Regra da conta de uma conversa do Claude: ela gasta só a conta que aparece no cabeçalho, nunca
// outra. Duas peças:
// - A conta gravada para a conversa (escolhida em qualquer janela, no acesso remoto ou no celular;
//   ver choices.ts) vale sobre a que veio no pedido: uma tela desatualizada (o celular abrindo a
//   conversa antes de saber a conta dela) não manda a mensagem pela conta do grupo.
// - Sessão aberta com outra conta que não a pedida fecha na hora, mesmo trabalhando ou com o remote
//   control ligado (a tela avisou o que para; ver shared/accountSwitch.ts), e a próxima mensagem
//   abre de novo com a certa, retomando a mesma conversa.

type Request = { key: string; sessionId?: string; account?: string };

// Conta gravada para a conversa, pela sessão ou, na conversa nova, pelo id provisório.
export type ChosenAccount = (id: string) => string | undefined;

export function withChosenAccount<T extends Request>(req: T, chosen?: ChosenAccount): T {
  const account = (req.sessionId && chosen?.(req.sessionId)) || chosen?.(req.key);
  return account && account !== req.account ? { ...req, account } : req;
}

// Sessão do Claude rodando com outra conta que não `account`. Conversa de outro agente fica de fora:
// a conta dela não troca depois de começada.
export function runsOtherAccount(session: ChatSession | AgentChatSession, account: string | undefined): boolean {
  return session instanceof ChatSession && !parseAgentRef(account) && session.account !== resolveAccount(account);
}
