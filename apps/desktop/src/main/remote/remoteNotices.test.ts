import { EventEmitter } from 'node:events';
import type { BrowserWindow } from 'electron';
import { describe, expect, it } from 'vitest';
import { RemoteClient } from './client';
import { RemoteHost } from './host';
import { memoryLinks } from './link';
import { REMOTE_BADGE, remoteBadgeTotal } from './remoteNotices';

// O notebook não sabia de nada das conversas do computador de casa: nem o número no Dock nem a
// notificação. O de casa avisa o Argus do notebook (não uma janela dele).

const INFO = { name: 'casa', platform: 'darwin', homeDir: '/Users/ana', windowsBuild: null, version: '1.2.3' };
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

function fakeWindow(id: number) {
  const wc = Object.assign(new EventEmitter(), {
    id,
    sent: [] as unknown[][],
    send(...args: unknown[]) {
      this.sent.push(args);
    },
    isDestroyed: () => false,
  });
  return { win: { webContents: wc } as unknown as BrowserWindow, wc };
}

describe('avisos do computador de casa no notebook', () => {
  it('o número de lá entra no do notebook, também para quem liga depois, e sai quando a ligação acaba', async () => {
    const host = new RemoteHost(() => INFO);
    // Antes de o notebook ligar: guardado para quem chegar.
    host.notify(REMOTE_BADGE, [2], true);
    const [hostSide, clientSide] = memoryLinks();
    host.accept(hostSide);
    const client = new RemoteClient(clientSide, '1.2.3', 'notebook');
    await client.connect();
    const { win, wc } = fakeWindow(7);
    client.attach(win);
    await settle();
    expect(remoteBadgeTotal()).toBe(2);

    host.notify(REMOTE_BADGE, [5], true);
    await settle();
    expect(remoteBadgeTotal()).toBe(5);
    // É do Argus do notebook, não da janela.
    expect(wc.sent.some(([ch]) => ch === REMOTE_BADGE)).toBe(false);

    client.close();
    expect(remoteBadgeTotal()).toBe(0);
  });
});
