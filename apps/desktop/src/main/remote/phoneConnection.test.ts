import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeWeb, encodeWeb } from '@argus/shared/webRemote';
import type { Link } from '../../../../mobile/src/net/crypto';
import { HostConnection } from '../../../../mobile/src/net/connection';

// A ligação do app do celular (apps/mobile/src/net/connection.ts) com um computador de casa de
// mentira, para ver o que ela faz quando ele para de responder sem a ligação fechar.

type FakeHost = { link: Link; answering: boolean; welcome: boolean; closed: boolean };
const hosts: FakeHost[] = [];

function fakeHost(): FakeHost {
  let deliver: (d: Uint8Array) => void = () => {};
  const reply = (m: Parameters<typeof encodeWeb>[0]) => queueMicrotask(() => deliver(encodeWeb(m)));
  const host: FakeHost = {
    answering: true,
    welcome: true,
    closed: false,
    link: {
      send: (data) => {
        const m = decodeWeb(data);
        if (!host.answering || !m) return;
        if (m.t === 'hello' && host.welcome) reply({ t: 'welcome', info: {} as never });
        if (m.t === 'call' && m.id) reply({ t: 'reply', id: m.id as number, ok: true, value: [] });
      },
      onMessage: (cb) => void (deliver = cb),
      onClose: () => {},
      close: () => void (host.closed = true),
    },
  };
  hosts.push(host);
  return host;
}

vi.mock('../../../../mobile/src/net/pairing', () => ({
  openSocket: vi.fn(async () => ({})),
  relayBase: () => 'ws://relay.test',
  unb64: () => new Uint8Array(32),
}));
vi.mock('../../../../mobile/src/net/handshake', () => ({
  HandshakeError: class extends Error {},
  openSession: vi.fn(async () => fakeHost().link),
}));

const connect = async () => {
  const conn = new HostConnection({ hostId: 'h', hostName: 'Casa', deviceId: 'd', psk: '' });
  conn.start();
  await vi.advanceTimersByTimeAsync(0);
  return conn;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  hosts.length = 0;
  vi.useRealTimers();
});

// 2026-11-14: trocando do Wi-Fi de casa para o 4G, a ligação morria sem aviso e o app seguia
// "conectado" sem receber nada até sair e voltar para a tela.
describe('ligação do celular que morre sem fechar', () => {
  it('com o computador respondendo, segue na mesma ligação', async () => {
    const conn = await connect();
    expect(conn.status).toBe('online');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(conn.status).toBe('online');
    expect(hosts).toHaveLength(1);
    conn.stop();
  });

  it('sem resposta, larga a ligação e religa sozinha', async () => {
    const conn = await connect();
    hosts[0].answering = false;
    // Batida (10 s) + prazo da conferência (8 s).
    await vi.advanceTimersByTimeAsync(18_000);
    expect(hosts[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(hosts).toHaveLength(2);
    expect(conn.status).toBe('online');
    conn.stop();
  });

  it('sem as boas-vindas depois do aperto de mão, tenta de novo em vez de ficar em "conectando"', async () => {
    const { openSession } = await import('../../../../mobile/src/net/handshake');
    vi.mocked(openSession).mockImplementationOnce(async () => {
      const silent = fakeHost();
      silent.welcome = false;
      return silent.link;
    });
    const conn = await connect();
    expect(conn.status).toBe('connecting');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(hosts[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(conn.status).toBe('online');
    conn.stop();
  });
});
