import { randomBytes } from 'node:crypto';
import { tr } from '../i18n';
import { devicePsk, directionKeys, newEphemeral, sameBytes, secureLink, sessionKeys, Spake2, type PairCode } from './crypto';
import type { DeviceKind } from '@argus/shared/webRemote';
import type { Link } from './link';

// Os apertos de mão pela ligação crua (a que passa pela ponte), antes de qualquer pedido: o do
// pareamento (código digitado uma vez) e o de cada conexão (aparelho já pareado). As mensagens
// daqui são JSON pequenos; terminado o aperto, a ligação devolvida já é a cifrada.

const STEP_TIMEOUT_MS = 20_000;
// O aperto de mão troca 2 ou 3 mensagens: quem manda mais que isto antes de terminar é derrubado (sem
// o limite, a fila guardaria tudo o que um atacante mandasse, até a memória acabar).
const MAX_QUEUED = 4;
// No pareamento, o de casa espera o código ser digitado no outro computador (a vaga na ponte dura
// 10 minutos).
export const PAIR_WAIT_MS = 10 * 60 * 1000;

// Lê as mensagens do aperto de mão uma a uma; as que chegarem depois (já cifradas) ficam para a
// ligação que segue (`rest`).
function splitLink(raw: Link) {
  const queue: Buffer[] = [];
  let waiting: ((d: Buffer | null) => void) | null = null;
  let handing = true;
  let closed = false;
  const restListeners: ((d: Buffer) => void)[] = [];
  raw.onMessage((data) => {
    if (!handing) return restListeners.forEach((cb) => cb(data));
    if (waiting) {
      const w = waiting;
      waiting = null;
      w(data);
    } else if (queue.length < MAX_QUEUED) queue.push(data);
    else raw.close();
  });
  raw.onClose(() => {
    closed = true;
    waiting?.(null);
    waiting = null;
  });
  return {
    async next(timeoutMs = STEP_TIMEOUT_MS): Promise<Record<string, unknown>> {
      const data =
        queue.shift() ??
        (closed
          ? null
          : await new Promise<Buffer | null>((resolve) => {
              const timer = setTimeout(() => {
                waiting = null;
                resolve(null);
              }, timeoutMs);
              waiting = (d) => {
                clearTimeout(timer);
                resolve(d);
              };
            }));
      if (!data) throw new HandshakeError('closed');
      try {
        const value: unknown = JSON.parse(data.toString('utf8'));
        if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
      } catch {
        // cai no erro abaixo
      }
      throw new HandshakeError('invalid');
    },
    send(message: Record<string, unknown>): void {
      raw.send(Buffer.from(JSON.stringify(message), 'utf8'));
    },
    // O resto da ligação: o que já chegou depois do aperto vai primeiro.
    rest(): Link {
      handing = false;
      const pending = queue.splice(0);
      return {
        send: (d) => raw.send(d),
        onMessage: (cb) => {
          restListeners.push(cb);
          if (pending.length) setImmediate(() => pending.splice(0).forEach((d) => cb(d)));
        },
        onClose: (cb) => raw.onClose(cb),
        close: () => raw.close(),
      };
    },
  };
}

export type HandshakeFailure = 'closed' | 'invalid' | 'wrong-code' | 'unknown-device' | 'bad-key';

export class HandshakeError extends Error {
  constructor(readonly reason: HandshakeFailure) {
    super(reason);
  }

  // Texto para a pessoa.
  get userMessage(): string {
    switch (this.reason) {
      case 'wrong-code':
        return tr('Código errado. Gere um código novo no outro computador e tente de novo.', 'Wrong code. Generate a new code on the other computer and try again.');
      case 'unknown-device':
        return tr(
          'Este computador não está mais pareado com o outro. Pareie de novo com um código novo.',
          'This computer is no longer paired with the other one. Pair again with a new code.',
        );
      case 'bad-key':
        return tr('A chave deste aparelho não confere. Pareie de novo com um código novo.', "This device's key doesn't match. Pair again with a new code.");
      case 'closed':
        return tr('O outro computador não respondeu a tempo.', 'The other computer did not answer in time.');
      default:
        return tr('O outro computador respondeu fora do esperado.', 'The other computer answered unexpectedly.');
    }
  }
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');

function bytes(value: unknown, length?: number): Buffer {
  if (typeof value !== 'string') throw new HandshakeError('invalid');
  const out = Buffer.from(value, 'base64');
  if (length !== undefined && out.length !== length) throw new HandshakeError('invalid');
  return out;
}

function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value || value.length > max) throw new HandshakeError('invalid');
  return value;
}

// --- Pareamento ---

// O que o computador de casa entrega ao aparelho novo, já pela ligação cifrada.
export type PairGrant = { hostId: string; hostName: string; deviceId: string; psk: Buffer };

// No computador de casa, com o código que ele mostrou. `grant` cria o aparelho (com o nome e o tipo
// que o outro mandou: sem tipo, outro Argus) e devolve o que entregar a ele.
type Grant = (deviceName: string, psk: Buffer, kind: DeviceKind) => PairGrant;

async function pairAsHostSteps(raw: Link, code: PairCode, grant: Grant): Promise<PairGrant> {
  const io = splitLink(raw);
  const spake = new Spake2('host', code);
  const first = await io.next(PAIR_WAIT_MS);
  if (first.t !== 'pake') throw new HandshakeError('invalid');
  let result: ReturnType<Spake2['finish']>;
  try {
    result = spake.finish(bytes(first.m, 32));
  } catch {
    throw new HandshakeError('invalid');
  }
  io.send({ t: 'pake', m: b64(spake.message), c: b64(result.myConfirm) });
  const second = await io.next();
  if (second.t !== 'confirm' || !sameBytes(bytes(second.c, 32), result.theirConfirm)) {
    io.send({ t: 'fail' });
    raw.close();
    throw new HandshakeError('wrong-code');
  }
  const keys = directionKeys(result.key, 'pair');
  const link = secureLink(io.rest(), keys.hostToClient, keys.clientToHost);
  const hello = await nextJson(link);
  const granted = grant(text(hello.name), devicePsk(result.key), hello.kind === 'web' ? 'web' : 'app');
  link.send(Buffer.from(JSON.stringify({ hostId: granted.hostId, hostName: granted.hostName, deviceId: granted.deviceId }), 'utf8'));
  return granted;
}

// No notebook, com o código digitado.
async function pairAsClientSteps(raw: Link, code: PairCode, deviceName: string): Promise<PairGrant> {
  const io = splitLink(raw);
  const spake = new Spake2('client', code);
  io.send({ t: 'pake', m: b64(spake.message) });
  const reply = await io.next();
  if (reply.t === 'fail') throw new HandshakeError('wrong-code');
  if (reply.t !== 'pake') throw new HandshakeError('invalid');
  let result: ReturnType<Spake2['finish']>;
  try {
    result = spake.finish(bytes(reply.m, 32));
  } catch {
    throw new HandshakeError('invalid');
  }
  // Confirmação errada: o código não é o mesmo (ou alguém no meio tentou adivinhar).
  if (!sameBytes(bytes(reply.c, 32), result.theirConfirm)) {
    raw.close();
    throw new HandshakeError('wrong-code');
  }
  io.send({ t: 'confirm', c: b64(result.myConfirm) });
  const keys = directionKeys(result.key, 'pair');
  const link = secureLink(io.rest(), keys.clientToHost, keys.hostToClient);
  link.send(Buffer.from(JSON.stringify({ name: deviceName }), 'utf8'));
  const granted = await nextJson(link);
  return { hostId: text(granted.hostId), hostName: text(granted.hostName), deviceId: text(granted.deviceId), psk: devicePsk(result.key) };
}

function nextJson(link: Link): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new HandshakeError('closed')), STEP_TIMEOUT_MS);
    link.onClose(() => {
      clearTimeout(timer);
      reject(new HandshakeError('closed'));
    });
    link.onMessage((data) => {
      clearTimeout(timer);
      try {
        const value: unknown = JSON.parse(data.toString('utf8'));
        if (value && typeof value === 'object') return resolve(value as Record<string, unknown>);
      } catch {
        // cai no erro abaixo
      }
      reject(new HandshakeError('invalid'));
    });
  });
}

// --- Cada conexão ---

// No computador de casa: confere o aparelho pela chave dele e devolve a ligação cifrada.
async function acceptSessionSteps(raw: Link, pskOf: (deviceId: string) => Buffer | null): Promise<{ link: Link; deviceId: string }> {
  const io = splitLink(raw);
  const hi = await io.next();
  if (hi.t !== 'hi' || hi.v !== 1) throw new HandshakeError('invalid');
  const deviceId = text(hi.d, 64);
  const clientPublic = bytes(hi.e, 32);
  const clientNonce = bytes(hi.n, 32);
  const psk = pskOf(deviceId);
  if (!psk) {
    io.send({ t: 'unknown' });
    raw.close();
    throw new HandshakeError('unknown-device');
  }
  const mine = newEphemeral();
  const hostNonce = randomBytes(32);
  let keys: ReturnType<typeof sessionKeys>;
  try {
    keys = sessionKeys({ mine, theirPublic: clientPublic, psk, deviceId, clientPublic, clientNonce, hostPublic: mine.publicKey, hostNonce });
  } catch {
    throw new HandshakeError('invalid');
  }
  io.send({ t: 'hey', e: b64(mine.publicKey), n: b64(hostNonce), c: b64(keys.hostConfirm) });
  const ok = await io.next();
  if (ok.t !== 'ok' || !sameBytes(bytes(ok.c, 32), keys.clientConfirm)) {
    raw.close();
    throw new HandshakeError('bad-key');
  }
  return { link: secureLink(io.rest(), keys.hostToClient, keys.clientToHost), deviceId };
}

// No notebook: apresenta o aparelho e confere que do outro lado está o computador pareado.
async function openSessionSteps(raw: Link, deviceId: string, psk: Buffer): Promise<Link> {
  const io = splitLink(raw);
  const mine = newEphemeral();
  const clientNonce = randomBytes(32);
  io.send({ t: 'hi', v: 1, d: deviceId, e: b64(mine.publicKey), n: b64(clientNonce) });
  const hey = await io.next();
  if (hey.t === 'unknown') throw new HandshakeError('unknown-device');
  if (hey.t !== 'hey') throw new HandshakeError('invalid');
  const hostPublic = bytes(hey.e, 32);
  let keys: ReturnType<typeof sessionKeys>;
  try {
    keys = sessionKeys({ mine, theirPublic: hostPublic, psk, deviceId, clientPublic: mine.publicKey, clientNonce, hostPublic, hostNonce: bytes(hey.n, 32) });
  } catch {
    throw new HandshakeError('invalid');
  }
  // Confirmação errada: do outro lado não está quem tem a chave deste aparelho.
  if (!sameBytes(bytes(hey.c, 32), keys.hostConfirm)) {
    raw.close();
    throw new HandshakeError('bad-key');
  }
  io.send({ t: 'ok', c: b64(keys.clientConfirm) });
  return secureLink(io.rest(), keys.clientToHost, keys.hostToClient);
}

// Falhou em qualquer passo: a ligação crua fecha (no de casa, libera a vaga na ponte e para de
// receber o que um atacante mandar).
async function closingOnError<T>(raw: Link, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    raw.close();
    throw err instanceof HandshakeError ? err : new HandshakeError('invalid');
  }
}

export const pairAsHost = (raw: Link, code: PairCode, grant: Grant) =>
  closingOnError(raw, () => pairAsHostSteps(raw, code, grant));
export const pairAsClient = (raw: Link, code: PairCode, deviceName: string) => closingOnError(raw, () => pairAsClientSteps(raw, code, deviceName));
export const acceptSession = (raw: Link, pskOf: (deviceId: string) => Buffer | null) => closingOnError(raw, () => acceptSessionSteps(raw, pskOf));
export const openSession = (raw: Link, deviceId: string, psk: Buffer) => closingOnError(raw, () => openSessionSteps(raw, deviceId, psk));
