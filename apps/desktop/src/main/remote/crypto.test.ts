import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { formatPairCode, NAMEPLATE_PATTERN, newPairCode, parsePairCode, secureLink, Spake2, type PairCode } from './crypto';
import { acceptSession, HandshakeError, openSession, pairAsClient, pairAsHost } from './handshake';
import { memoryLinks, type Link } from './link';

// A criptografia do acesso remoto: quem sabe o código pareia, quem não sabe não pareia nem
// conecta, e mensagem alterada no caminho derruba a ligação em vez de chegar.

const CODE: PairCode = { nameplate: 'K7Q4M', secret: '913776' };

const received = (link: Link) => {
  const got: Buffer[] = [];
  link.onMessage((d) => got.push(d));
  return got;
};
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
};

describe('código de pareamento', () => {
  it('aceita minúsculas, espaço, hífen ou junto; recusa o resto', () => {
    expect(parsePairCode('K7Q4M-913776')).toEqual(CODE);
    expect(parsePairCode(' k7q4m 913 776 ')).toEqual(CODE);
    expect(parsePairCode('K7Q4M913776')).toEqual(CODE);
    // O e I/L lidos como 0 e 1.
    expect(parsePairCode('KO1LM-913776')).toEqual({ nameplate: 'K011M', secret: '913776' });
    expect(parsePairCode('K7Q4M-91377')).toBeNull();
    expect(parsePairCode('K7Q4U-913776')).toBeNull();
    expect(parsePairCode('K7Q4M-91377A')).toBeNull();
  });

  it('o código novo sempre passa na leitura (e o endereço tem 5 letras e números)', () => {
    for (let i = 0; i < 200; i++) {
      const code = newPairCode();
      expect(code.nameplate).toMatch(NAMEPLATE_PATTERN);
      expect(parsePairCode(formatPairCode(code))).toEqual(code);
    }
  });
});

describe('SPAKE2', () => {
  it('mesmo código: mesma chave e confirmações que batem', () => {
    const a = new Spake2('client', CODE);
    const b = new Spake2('host', CODE);
    const ra = a.finish(b.message);
    const rb = b.finish(a.message);
    expect(ra.key.equals(rb.key)).toBe(true);
    expect(ra.myConfirm.equals(rb.theirConfirm)).toBe(true);
    expect(rb.myConfirm.equals(ra.theirConfirm)).toBe(true);
  });

  it('código diferente: chaves diferentes', () => {
    const a = new Spake2('client', CODE);
    const b = new Spake2('host', { ...CODE, secret: '913777' });
    expect(a.finish(b.message).key.equals(b.finish(a.message).key)).toBe(false);
  });

  it('recusa ponto inválido', () => {
    expect(() => new Spake2('host', CODE).finish(new Uint8Array(32))).toThrow();
    expect(() => new Spake2('host', CODE).finish(new Uint8Array(32).fill(255))).toThrow();
  });
});

describe('pareamento pela ligação', () => {
  it('com o código certo, os dois saem com a mesma chave do aparelho', async () => {
    const [h, c] = memoryLinks();
    const host = pairAsHost(h, CODE, (name, psk) => ({ hostId: 'room-1', hostName: 'casa', deviceId: `dev-${name}`, psk }));
    const client = pairAsClient(c, CODE, 'notebook');
    const [hg, cg] = await Promise.all([host, client]);
    expect(cg).toMatchObject({ hostId: 'room-1', hostName: 'casa', deviceId: 'dev-notebook' });
    expect(cg.psk.equals(hg.psk)).toBe(true);
  });

  it('com o código errado, nenhum lado pareia', async () => {
    const [h, c] = memoryLinks();
    const [host, client] = await Promise.allSettled([
      pairAsHost(h, CODE, () => {
        throw new Error('não devia criar aparelho');
      }),
      pairAsClient(c, { ...CODE, secret: '000000' }, 'notebook'),
    ]);
    expect(client).toMatchObject({ status: 'rejected', reason: { reason: 'wrong-code' } });
    expect(host).toMatchObject({ status: 'rejected', reason: expect.any(HandshakeError) });
  });
});

describe('conexão de aparelho pareado', () => {
  const psk = randomBytes(32);

  it('com a chave certa, a ligação cifrada leva mensagens nos dois sentidos', async () => {
    const [h, c] = memoryLinks();
    const [hostSide, clientLink] = await Promise.all([acceptSession(h, (id) => (id === 'dev-1' ? psk : null)), openSession(c, 'dev-1', psk)]);
    expect(hostSide.deviceId).toBe('dev-1');
    const atHost = received(hostSide.link);
    const atClient = received(clientLink);
    clientLink.send(Buffer.from('pedido'));
    hostSide.link.send(Buffer.from('resposta'));
    await settle();
    expect(atHost.map(String)).toEqual(['pedido']);
    expect(atClient.map(String)).toEqual(['resposta']);
  });

  it('aparelho removido não conecta', async () => {
    const [h, c] = memoryLinks();
    const [host, client] = await Promise.allSettled([acceptSession(h, () => null), openSession(c, 'dev-1', psk)]);
    expect(client).toMatchObject({ status: 'rejected', reason: { reason: 'unknown-device' } });
    expect(host).toMatchObject({ status: 'rejected', reason: { reason: 'unknown-device' } });
  });

  it('chave errada não conecta (nem para quem se passa pelo de casa)', async () => {
    const [h, c] = memoryLinks();
    const [host, client] = await Promise.allSettled([acceptSession(h, () => randomBytes(32)), openSession(c, 'dev-1', psk)]);
    expect(client).toMatchObject({ status: 'rejected', reason: { reason: 'bad-key' } });
    expect(host.status).toBe('rejected');
  });
});

describe('quem não autentica é derrubado (revisão de segurança, 2026-11-11)', () => {
  // Antes, a ligação ficava aberta e tudo o que chegasse se acumulava na memória do de casa.
  it('mensagem inválida no aperto de mão fecha a ligação', async () => {
    const [h, c] = memoryLinks();
    let closed = false;
    c.onClose(() => (closed = true));
    const host = acceptSession(h, () => randomBytes(32));
    c.send(Buffer.from('{"t":"x"}'));
    await expect(host).rejects.toBeInstanceOf(HandshakeError);
    await settle();
    expect(closed).toBe(true);
  });

  it('enxurrada de mensagens antes de autenticar fecha a ligação', async () => {
    const [h, c] = memoryLinks();
    let closed = false;
    c.onClose(() => (closed = true));
    const host = pairAsHost(h, CODE, () => {
      throw new Error('não devia parear');
    });
    // Fora de ordem e sem parar: nenhuma vira o primeiro passo.
    void host.catch(() => {});
    for (let i = 0; i < 50; i++) c.send(randomBytes(1000));
    await settle();
    expect(closed).toBe(true);
  });
});

describe('mensagens cifradas', () => {
  const k1 = randomBytes(32);
  const k2 = randomBytes(32);

  it('mensagem grande chega inteira (vai em pedaços)', async () => {
    const [a, b] = memoryLinks();
    const sa = secureLink(a, k1, k2);
    const sb = secureLink(b, k2, k1);
    const got = received(sb);
    const big = randomBytes(1_000_000);
    sa.send(big);
    sa.send(Buffer.alloc(0));
    await settle();
    expect(got).toHaveLength(2);
    expect(got[0].equals(big)).toBe(true);
    expect(got[1]).toHaveLength(0);
  });

  it('mensagem alterada no caminho fecha a ligação e não chega', async () => {
    const [a, b] = memoryLinks();
    // A ponte, no meio, troca um byte.
    const tampered: Link = { ...a, send: (d) => a.send(Buffer.from(d.map((x, i) => (i === 3 ? x ^ 1 : x)))) };
    const sa = secureLink(tampered, k1, k2);
    const sb = secureLink(b, k2, k1);
    const got = received(sb);
    let closed = false;
    sb.onClose(() => (closed = true));
    sa.send(Buffer.from('rm -rf'));
    await settle();
    expect(got).toHaveLength(0);
    expect(closed).toBe(true);
  });

  it('mensagem repetida pela ponte fecha a ligação', async () => {
    const [a, b] = memoryLinks();
    let last: Buffer | null = null;
    const recorder: Link = {
      ...a,
      send: (d) => {
        last = d;
        a.send(d);
      },
    };
    const sa = secureLink(recorder, k1, k2);
    const sb = secureLink(b, k2, k1);
    const got = received(sb);
    let closed = false;
    sb.onClose(() => (closed = true));
    sa.send(Buffer.from('uma vez'));
    await settle();
    a.send(last!);
    await settle();
    expect(got.map(String)).toEqual(['uma vez']);
    expect(closed).toBe(true);
  });
});
