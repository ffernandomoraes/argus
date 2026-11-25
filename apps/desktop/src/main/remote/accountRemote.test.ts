import { afterEach, describe, expect, it, vi } from 'vitest';

const pairing = vi.hoisted(() => ({ links: [] as { closed: boolean; close: () => void }[], pairs: [] as ((v: unknown) => void)[] }));

vi.mock('./relay', () => ({
  RelayError: class extends Error {},
  connectPairing: async () => {
    const link = { closed: false, close: () => (link.closed = true) };
    pairing.links.push(link);
    return link;
  },
}));
vi.mock('./handshake', () => ({
  PAIR_WAIT_MS: 10 * 60_000,
  pairAsHost: () => new Promise((resolve) => pairing.pairs.push(resolve)),
}));

const { AccountSlot, listAccountHosts, openFromAccount } = await import('./accountRemote');

// A vaga do computador de casa para os aparelhos da conta, e abrir de longe pelo código da conta.

afterEach(() => {
  pairing.links.length = 0;
  pairing.pairs.length = 0;
});


describe('AccountSlot', () => {
  it('publishes the code, opens a new slot after a pairing and unpublishes on stop', async () => {
    const calls: { path: string; method?: string; body?: { code?: string; hostId?: string } }[] = [];
    const bridge = {
      request: async <T>(path: string, method?: string, body?: unknown): Promise<T | null> => {
        calls.push({ path, method, body: body as { code?: string } });
        return null;
      },
    };
    const paired = vi.fn();
    const slot = new AccountSlot('room-1234567890', bridge, () => ({ hostId: 'h', hostName: 'n', deviceId: 'd', psk: Buffer.alloc(32) }), paired);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    slot.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls[0]).toMatchObject({ path: '/api/remote/host', method: 'PUT', body: { hostId: 'room-1234567890' } });
    expect(calls[0]!.body!.code).toMatch(/^[0-9A-Z]{5}-\d{6}$/);

    pairing.pairs[0]!({ hostId: 'h', hostName: 'n', deviceId: 'd', psk: Buffer.alloc(32) });
    await vi.advanceTimersByTimeAsync(1000);
    expect(paired).toHaveBeenCalledTimes(1);
    expect(pairing.links[0]!.closed).toBe(true);
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(2);

    slot.stop(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.at(-1)).toMatchObject({ path: '/api/remote/host', method: 'DELETE' });
    expect(pairing.links[1]!.closed).toBe(true);
    vi.useRealTimers();
  });
});

describe('openFromAccount', () => {
  // A conta de mentira: a lista com o código da vez e um bilhete novo a cada pedido.
  const hostsWith = (...codes: (string | null)[]) => {
    let i = 0;
    let tickets = 0;
    return {
      request: async <T>(path: string): Promise<T | null> =>
        (path === '/api/remote/ticket'
          ? { ticket: `bilhete-${++tickets}` }
          : { hosts: [{ id: 's', hostId: 'room', name: 'PC', platform: 'win32', code: codes[Math.min(i++, codes.length - 1)] }] }) as T,
    };
  };

  it('pairs with the published code and opens', async () => {
    const pair = vi.fn(async () => ({ ok: true as const, hostId: 'room', name: 'PC' }));
    const open = vi.fn(async () => null);
    expect(await openFromAccount(hostsWith('AAAAA-111111'), 'room', { pair, open })).toBeNull();
    expect(pair).toHaveBeenCalledWith('AAAAA-111111', 'bilhete-1');
    expect(open).toHaveBeenCalledWith('room');
  });

  it('tries once more with a fresh code', async () => {
    const pair = vi.fn().mockResolvedValueOnce({ ok: false, error: 'vencido' }).mockResolvedValueOnce({ ok: true, hostId: 'room', name: 'PC' });
    const open = vi.fn(async () => null);
    expect(await openFromAccount(hostsWith('AAAAA-111111', 'BBBBB-222222'), 'room', { pair, open })).toBeNull();
    expect(pair).toHaveBeenLastCalledWith('BBBBB-222222', 'bilhete-2');
  });

  it('explains when the computer is off or there is no account', async () => {
    const ops = { pair: vi.fn(), open: vi.fn() };
    expect(await openFromAccount(hostsWith(null), 'room', ops)).toMatch(/não está aceitando|not accepting/);
    expect(await openFromAccount(null, 'room', ops)).toMatch(/conta|account/);
    expect(ops.pair).not.toHaveBeenCalled();
  });

  it('does not pair without a ticket from the account', async () => {
    const ops = { pair: vi.fn(), open: vi.fn() };
    const noTicket = { request: async <T>(path: string): Promise<T | null> => (path === '/api/remote/ticket' ? null : ({ hosts: [{ id: 's', hostId: 'room', code: 'AAAAA-111111' }] } as T)) };
    expect(await openFromAccount(noTicket, 'room', ops)).toMatch(/não está aceitando|not accepting/);
    expect(ops.pair).not.toHaveBeenCalled();
  });

  it('lists hosts without the codes', async () => {
    expect(await listAccountHosts(hostsWith('AAAAA-111111'))).toEqual([{ hostId: 'room', name: 'PC', platform: 'win32', available: true }]);
  });
});
