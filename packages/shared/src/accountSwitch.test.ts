import { describe, expect, it } from 'vitest';
import { accountSwitchStops, joinStops } from './accountSwitch';
import type { ChatState } from './chat';

const state = (patch: Partial<ChatState>): ChatState =>
  ({ status: 'idle', partial: '', permissions: [], revision: 0, turnTokens: 0, agents: [], backgroundTasks: 0, ...patch }) as ChatState;
const pt = (s: ChatState) => accountSwitchStops(s).map(([text]) => text);

describe('o que para ao trocar a conta da conversa', () => {
  it('parada ou sem sessão: nada, troca sem perguntar', () => {
    expect(accountSwitchStops(null)).toEqual([]);
    expect(accountSwitchStops(state({}))).toEqual([]);
    expect(accountSwitchStops(state({ remote: { status: 'failed' } }))).toEqual([]);
  });

  it('lista o pedido, os subagentes, os comandos, a fila e o remote control', () => {
    const s = state({
      status: 'running',
      turnStartedAt: 1,
      agents: [{}, {}] as ChatState['agents'],
      backgroundTasks: 1,
      queued: [{ id: 'q', text: 'oi', at: 1 }],
      remote: { status: 'connected' },
    });
    expect(pt(s)).toEqual([
      'o pedido em andamento',
      '2 subagentes',
      'um comando em segundo plano',
      'uma mensagem na fila, que não será enviada',
      'o controle remoto (claude.ai e celular), que fica desligado',
    ]);
  });

  it('trabalhando só com o que ficou em segundo plano: não fala de pedido', () => {
    expect(pt(state({ status: 'running', backgroundTasks: 2 }))).toEqual(['2 comandos em segundo plano']);
    expect(pt(state({ status: 'needs-you' }))).toEqual(['o pedido que espera a sua resposta']);
  });

  it('junta com vírgula e "e"', () => {
    expect(joinStops(['a'], 'e')).toBe('a');
    expect(joinStops(['a', 'b', 'c'], 'e')).toBe('a, b e c');
  });
});
