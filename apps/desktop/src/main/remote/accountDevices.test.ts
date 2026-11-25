import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false } }));

const { AccountDevices } = await import('./accountDevices');
const { AccountHttpError } = await import('../account/http');
const { HandshakeError } = await import('./handshake');

// Pareados pela conta, presos à sessão da conta de cada aparelho: bilhete no pareamento, conferência
// a cada entrada, aviso da conta, saída da conta e remoção aqui.

type Device = { id: string; name: string; psk: string; pairedAt: number; accountSession?: string };

function setup(answer: (path: string, method?: string, body?: unknown) => unknown, signedIn = true) {
  let devices: Device[] = [
    { id: 'phone', name: 'iPhone', psk: 'x', pairedAt: 1, accountSession: 'sess-phone' },
    { id: 'laptop', name: 'Notebook', psk: 'x', pairedAt: 1, accountSession: 'sess-laptop' },
    { id: 'old', name: 'Pareado por código', psk: 'x', pairedAt: 1 },
  ];
  let removals: string[] = [];
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const bridge = {
    request: async <T>(path: string, method?: string, body?: unknown): Promise<T | null> => {
      calls.push({ path, method, body });
      const r = answer(path, method, body);
      if (r instanceof Error) throw r;
      return r as T;
    },
  };
  const accountDevices = new AccountDevices({
    bridge: () => (signedIn ? bridge : null),
    devices: () => devices as never,
    drop: (id) => {
      devices = devices.filter((d) => d.id !== id);
    },
    removals: { get: () => removals, set: (list) => (removals = list) },
  });
  return { accountDevices, calls, ids: () => devices.map((d) => d.id), removals: () => removals };
}

const device = (session?: string) => ({ id: 'phone', name: 'iPhone', psk: 'x', pairedAt: 1, ...(session && { accountSession: session }) });

describe('pareamento pela conta', () => {
  it('only grants with a ticket the account turns into a session', async () => {
    const { accountDevices } = setup((path, _m, body) => (path === '/api/remote/claim' && (body as { ticket: string }).ticket === 'ok' ? { sessionId: 'sess-new' } : new AccountHttpError(404, 'x')));
    const create = vi.fn(() => ({ hostId: 'h', hostName: 'n', deviceId: 'd', psk: Buffer.alloc(32) }));
    const grant = accountDevices.grant(create);
    await expect(grant('iPhone', Buffer.alloc(32), 'web', null)).rejects.toBeInstanceOf(HandshakeError);
    await expect(grant('iPhone', Buffer.alloc(32), 'web', 'falso')).rejects.toBeInstanceOf(HandshakeError);
    await grant('iPhone', Buffer.alloc(32), 'web', 'ok');
    expect(create).toHaveBeenCalledWith('iPhone', expect.any(Buffer), 'web', 'sess-new');
  });

  it('refuses a session removed here that the account did not drop yet', async () => {
    const { accountDevices } = setup((path) => (path === '/api/remote/claim' ? { sessionId: 'sess-phone' } : new Error('offline')));
    accountDevices.forget(device('sess-phone') as never);
    await expect(accountDevices.grant(vi.fn())('iPhone', Buffer.alloc(32), 'web', 'ok')).rejects.toBeInstanceOf(HandshakeError);
  });
});

describe('cada entrada', () => {
  it('lets in while the session is alive and counts it as use', async () => {
    const { accountDevices, calls, ids } = setup(() => ({ alive: ['sess-phone'] }));
    expect(await accountDevices.allow(device('sess-phone') as never)).toBe(true);
    expect(calls[0]).toMatchObject({ path: '/api/remote/check', body: { ids: ['sess-phone'], seen: ['sess-phone'] } });
    expect(ids()).toContain('phone');
  });

  it('drops the pairing when the account says the session is gone', async () => {
    const { accountDevices, ids } = setup(() => ({ alive: [] }));
    expect(await accountDevices.allow(device('sess-phone') as never)).toBe(false);
    expect(ids()).not.toContain('phone');
  });

  it('lets in without an answer from the account, but not without the account here', async () => {
    expect(await setup(() => new Error('offline')).accountDevices.allow(device('sess-phone') as never)).toBe(true);
    const signedOut = setup(() => ({ alive: [] }), false);
    expect(await signedOut.accountDevices.allow(device('sess-phone') as never)).toBe(false);
    expect(signedOut.ids()).toContain('phone');
  });

  it('pairings by code are not checked', async () => {
    const { accountDevices, calls } = setup(() => ({ alive: [] }));
    expect(await accountDevices.allow(device() as never)).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe('a conta avisa, confere e sai', () => {
  it('drops the device the account says was removed, and all of them when the account leaves', () => {
    const { accountDevices, ids } = setup(() => null);
    accountDevices.removed('sess-laptop');
    expect(ids()).toEqual(['phone', 'old']);
    accountDevices.gone();
    expect(ids()).toEqual(['old']);
  });

  it('sweeps the sessions that are gone', async () => {
    const { accountDevices, ids } = setup(() => ({ alive: ['sess-laptop'] }));
    await accountDevices.sweep();
    expect(ids()).toEqual(['laptop', 'old']);
  });

  it('removing here takes the session out of the account, and retries when offline', async () => {
    let online = false;
    const { accountDevices, calls, removals } = setup((path, method) => {
      if (method !== 'DELETE') return { alive: ['sess-phone', 'sess-laptop'] };
      return online ? null : new Error('offline');
    });
    accountDevices.forget(device('sess-phone') as never);
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(removals()).toEqual(['sess-phone']);
    online = true;
    await accountDevices.sweep();
    expect(calls.filter((c) => c.method === 'DELETE').at(-1)).toMatchObject({ path: '/api/devices/sess-phone' });
    expect(removals()).toEqual([]);
  });
});
