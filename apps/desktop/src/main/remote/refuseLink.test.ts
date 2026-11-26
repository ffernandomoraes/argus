import { decodeWeb } from '@argus/shared/webRemote';
import { describe, expect, it } from 'vitest';
import { memoryLinks } from './link';
import { refuseLink } from './refuseLink';
import type { PairedDevice } from './store';

// Recusa de um aparelho pareado pela conta: o celular que continua pareado recebe o motivo antes de a
// ligação fechar (antes, só fechava, e o app ficava em "Conectando…" para sempre).

const phone: PairedDevice = { id: 'd1', name: 'iPhone', psk: 'x', pairedAt: 0, kind: 'web', accountSession: 's1' };

function received(stillPaired: boolean, device = phone): Promise<{ messages: Record<string, unknown>[]; closed: boolean }> {
  const [host, client] = memoryLinks();
  const messages: Record<string, unknown>[] = [];
  return new Promise((resolve) => {
    client.onMessage((d) => {
      const m = decodeWeb(d);
      if (m) messages.push(m);
    });
    client.onClose(() => resolve({ messages, closed: true }));
    refuseLink(host, device, stillPaired, 'Mac');
  });
}

describe('refuseLink', () => {
  it('ainda pareado: o celular recebe o motivo e a ligação fecha', async () => {
    const { messages, closed } = await received(true);
    expect(closed).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].t).toBe('reject');
    expect(String(messages[0].reason)).toContain('Mac');
  });

  it('pareamento removido: só fecha (o celular vê "não reconhece mais este aparelho" na próxima)', async () => {
    expect(await received(false)).toEqual({ messages: [], closed: true });
  });

  it('notebook (não é o app do celular): só fecha', async () => {
    expect(await received(true, { ...phone, kind: 'app' })).toEqual({ messages: [], closed: true });
  });
});
