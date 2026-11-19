import { describe, expect, it } from 'vitest';
import { antigravityUsage } from './antigravityParse';

// Saída real do `agy --output-format json -p /usage` (1.5.12, plano gratuito), sem o que não é lido.
const FREE = JSON.stringify({
  conversation_id: '',
  status: 'SUCCESS',
  command: {
    name: 'usage',
    data: {
      groups: [
        {
          name: 'Gemini Models',
          description: 'Models within this group: Gemini 3.8 Flash',
          buckets: [{ id: 'gemini-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 0.9832215905189514, reset_time: '2026-11-26T13:21:51Z' }],
        },
        {
          name: 'Claude and GPT models',
          buckets: [{ id: '3p-weekly', name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 1, reset_time: '2026-11-26T13:24:19Z' }],
        },
      ],
    },
  },
});

describe('limites do Antigravity', () => {
  it('plano gratuito: o semanal dos Gemini é o da conta; o outro grupo entra à parte, com o nome', () => {
    expect(antigravityUsage(FREE, 5)).toEqual({
      session: { percent: 2, resetsAt: '2026-11-26T13:21:51Z', minutes: 10_080 },
      weekly: null,
      models: [{ name: 'Claude e GPT', window: { percent: 0, resetsAt: '2026-11-26T13:24:19Z', minutes: 10_080 } }],
      updatedAt: 5,
    });
  });

  it('plano com duas janelas: a mais curta primeiro, e o balde desligado fica de fora', () => {
    const paid = JSON.stringify({
      command: {
        data: {
          groups: [
            {
              name: 'Gemini Models',
              buckets: [
                { name: 'Weekly Limit Remaining', window: 'weekly', remaining_fraction: 0.5, reset_time: '2026-11-26T13:00:00Z' },
                { name: '5 Hour Limit Remaining', window: '5h', remaining_fraction: 0.25, reset_time: '2026-11-19T18:00:00Z' },
                { name: 'Credits', window: 'weekly', remaining_fraction: 1, disabled: true },
              ],
            },
          ],
        },
      },
    });
    const usage = antigravityUsage(paid, 1);
    expect(usage?.session).toEqual({ percent: 75, resetsAt: '2026-11-19T18:00:00Z', minutes: 300 });
    expect(usage?.weekly).toEqual({ percent: 50, resetsAt: '2026-11-26T13:00:00Z', minutes: 10_080 });
  });

  it('conta por chave ou saída estranha: sem limite, sem erro', () => {
    expect(antigravityUsage('Usage is not available with an API key.', 1)).toBeNull();
    expect(antigravityUsage(JSON.stringify({ status: 'SUCCESS', command: { name: 'usage', data: {} } }), 1)).toBeNull();
    expect(antigravityUsage('', 1)).toBeNull();
  });
});
