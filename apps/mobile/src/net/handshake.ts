import { devicePsk, directionKeys, newEphemeral, randomBytes, sameBytes, secureLink, sessionKeys, Spake2Client, type Link, type PairCode } from './crypto'

// Os apertos de mão do lado do aparelho, iguais aos do app (apps/desktop/src/main/remote/handshake.ts): o do
// pareamento (código uma vez) e o de cada conexão. Mensagens em JSON pela ligação crua; terminado o
// aperto, a ligação devolvida já é a cifrada.

const STEP_TIMEOUT_MS = 20_000
const MAX_QUEUED = 4

export type HandshakeFailure = 'closed' | 'invalid' | 'wrong-code' | 'unknown-device' | 'bad-key'

export class HandshakeError extends Error {
  constructor(readonly reason: HandshakeFailure) {
    super(reason)
  }
}

const b64 = (b: Uint8Array) => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s)
}

function bytes(value: unknown, length?: number): Uint8Array {
  if (typeof value !== 'string') throw new HandshakeError('invalid')
  let s: string
  try {
    s = atob(value)
  } catch {
    throw new HandshakeError('invalid')
  }
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  if (length !== undefined && out.length !== length) throw new HandshakeError('invalid')
  return out
}

function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value || value.length > max) throw new HandshakeError('invalid')
  return value
}

function splitLink(raw: Link) {
  const queue: Uint8Array[] = []
  let waiting: ((d: Uint8Array | null) => void) | null = null
  let handing = true
  let closed = false
  const restListeners: ((d: Uint8Array) => void)[] = []
  raw.onMessage((data) => {
    if (!handing) return restListeners.forEach((cb) => cb(data))
    if (waiting) {
      const w = waiting
      waiting = null
      w(data)
    } else if (queue.length < MAX_QUEUED) queue.push(data)
    else raw.close()
  })
  raw.onClose(() => {
    closed = true
    waiting?.(null)
    waiting = null
  })
  return {
    async next(): Promise<Record<string, unknown>> {
      const data =
        queue.shift() ??
        (closed
          ? null
          : await new Promise<Uint8Array | null>((resolve) => {
              const timer = setTimeout(() => {
                waiting = null
                resolve(null)
              }, STEP_TIMEOUT_MS)
              waiting = (d) => {
                clearTimeout(timer)
                resolve(d)
              }
            }))
      if (!data) throw new HandshakeError('closed')
      try {
        const value: unknown = JSON.parse(new TextDecoder().decode(data))
        if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
      } catch {
        // cai no erro abaixo
      }
      throw new HandshakeError('invalid')
    },
    send(message: Record<string, unknown>): void {
      raw.send(new TextEncoder().encode(JSON.stringify(message)))
    },
    rest(): Link {
      handing = false
      const pending = queue.splice(0)
      return {
        send: (d) => raw.send(d),
        onMessage: (cb) => {
          restListeners.push(cb)
          if (pending.length) setTimeout(() => pending.splice(0).forEach((d) => cb(d)), 0)
        },
        onClose: (cb) => raw.onClose(cb),
        close: () => raw.close()
      }
    }
  }
}

function nextJson(link: Link): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new HandshakeError('closed')), STEP_TIMEOUT_MS)
    link.onClose(() => {
      clearTimeout(timer)
      reject(new HandshakeError('closed'))
    })
    link.onMessage((data) => {
      clearTimeout(timer)
      try {
        const value: unknown = JSON.parse(new TextDecoder().decode(data))
        if (value && typeof value === 'object') return resolve(value as Record<string, unknown>)
      } catch {
        // cai no erro abaixo
      }
      reject(new HandshakeError('invalid'))
    })
  })
}

export type PairGrant = { hostId: string; hostName: string; deviceId: string; psk: Uint8Array }

async function closingOnError<T>(raw: Link, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    raw.close()
    throw err instanceof HandshakeError ? err : new HandshakeError('invalid')
  }
}

// Pareia este navegador com o código mostrado no computador de casa.
export const pairAsClient = (raw: Link, code: PairCode, deviceName: string): Promise<PairGrant> =>
  closingOnError(raw, async () => {
    const io = splitLink(raw)
    const spake = new Spake2Client(code)
    io.send({ t: 'pake', m: b64(spake.message) })
    const reply = await io.next()
    if (reply.t === 'fail') throw new HandshakeError('wrong-code')
    if (reply.t !== 'pake') throw new HandshakeError('invalid')
    let result: Awaited<ReturnType<Spake2Client['finish']>>
    try {
      result = await spake.finish(bytes(reply.m, 32))
    } catch {
      throw new HandshakeError('invalid')
    }
    if (!sameBytes(bytes(reply.c, 32), result.theirConfirm)) throw new HandshakeError('wrong-code')
    io.send({ t: 'confirm', c: b64(result.myConfirm) })
    const keys = await directionKeys(result.key, 'pair')
    const link = secureLink(io.rest(), keys.clientToHost, keys.hostToClient)
    // kind: o computador de casa trata este aparelho como o app do celular (ver webHost.ts).
    link.send(new TextEncoder().encode(JSON.stringify({ name: deviceName, kind: 'web' })))
    const granted = await nextJson(link)
    return { hostId: text(granted.hostId), hostName: text(granted.hostName), deviceId: text(granted.deviceId), psk: await devicePsk(result.key) }
  })

// Abre uma conexão de um aparelho já pareado e confere que do outro lado está o computador certo.
export const openSession = (raw: Link, deviceId: string, psk: Uint8Array): Promise<Link> =>
  closingOnError(raw, async () => {
    const io = splitLink(raw)
    const mine = newEphemeral()
    const clientNonce = randomBytes(32)
    io.send({ t: 'hi', v: 1, d: deviceId, e: b64(mine.publicKey), n: b64(clientNonce) })
    const hey = await io.next()
    if (hey.t === 'unknown') throw new HandshakeError('unknown-device')
    if (hey.t !== 'hey') throw new HandshakeError('invalid')
    const hostPublic = bytes(hey.e, 32)
    let keys: Awaited<ReturnType<typeof sessionKeys>>
    try {
      keys = await sessionKeys({ mine, theirPublic: hostPublic, psk, deviceId, clientPublic: mine.publicKey, clientNonce, hostPublic, hostNonce: bytes(hey.n, 32) })
    } catch {
      throw new HandshakeError('invalid')
    }
    if (!sameBytes(bytes(hey.c, 32), keys.hostConfirm)) throw new HandshakeError('bad-key')
    io.send({ t: 'ok', c: b64(keys.clientConfirm) })
    return secureLink(io.rest(), keys.clientToHost, keys.hostToClient)
  })
