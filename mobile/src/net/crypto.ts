import { ristretto255, ristretto255_hasher, x25519 } from '@noble/curves/ed25519.js'

// A mesma criptografia do acesso remoto do Argus (src/main/remote/crypto.ts), no navegador: SPAKE2
// sobre ristretto255 no pareamento, X25519 + psk em cada conexão e AES-256-GCM com contador por
// sentido nas mensagens. Tem que dar os mesmos bytes que a do app (ver remote/webInterop.test.ts).

export interface Link {
  send(data: Uint8Array): void
  onMessage(cb: (data: Uint8Array) => void): void
  onClose(cb: () => void): void
  close(): void
}

const enc = new TextEncoder()
const Point = ristretto255.Point
const subtle = () => globalThis.crypto.subtle

// Cópia com um ArrayBuffer próprio: o que a WebCrypto aceita.
const own = (b: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(b)

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

function lengthPrefixed(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out: Uint8Array[] = []
  for (const p of parts) {
    const len = new Uint8Array(8)
    new DataView(len.buffer).setBigUint64(0, BigInt(p.length), true)
    out.push(len, p)
  }
  return concat(...out)
}

export async function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await subtle().digest('SHA-256', own(data)))
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const k = await subtle().importKey('raw', own(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await subtle().sign('HMAC', k, own(data)))
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const k = await subtle().importKey('raw', own(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: own(salt), info: own(info) }, k, length * 8))
}

// Comparação sem atalho no primeiro byte diferente.
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function randomScalar(): bigint {
  for (;;) {
    const s = ristretto255_hasher.hashToScalar(randomBytes(64), { DST: 'argus-remote-v1-random' })
    if (s !== 0n) return s
  }
}

// --- Pareamento: SPAKE2 ---

const DST = 'argus-remote-v1-spake2'
const M = ristretto255_hasher.hashToCurve(enc.encode('argus spake2 M'), { DST })
const N = ristretto255_hasher.hashToCurve(enc.encode('argus spake2 N'), { DST })

export type PairCode = { nameplate: string; secret: string }

const NAMEPLATE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}$/

// Aceita minúsculas, espaços, hífens e pontos; O vira 0 e I/L viram 1 (como no app).
export function parsePairCode(text: string): PairCode | null {
  const only = text.toUpperCase().replace(/[\s.-]/g, '')
  if (only.length !== 11) return null
  const nameplate = only.slice(0, 5).replace(/O/g, '0').replace(/[IL]/g, '1')
  const secret = only.slice(5)
  return NAMEPLATE_PATTERN.test(nameplate) && /^\d{6}$/.test(secret) ? { nameplate, secret } : null
}

// O lado do aparelho (cliente) no SPAKE2.
export class Spake2Client {
  private readonly scalar = randomScalar()
  private readonly w: bigint
  readonly message: Uint8Array

  constructor(private readonly code: PairCode) {
    this.w = ristretto255_hasher.hashToScalar(lengthPrefixed(enc.encode('argus-pair-v1'), enc.encode(code.nameplate), enc.encode(code.secret)), { DST })
    this.message = Point.BASE.multiply(this.scalar).add(M.multiply(this.w)).toBytes()
  }

  async finish(theirs: Uint8Array): Promise<{ key: Uint8Array; myConfirm: Uint8Array; theirConfirm: Uint8Array }> {
    const other = Point.fromBytes(theirs)
    if (other.is0()) throw new Error('ponto inválido')
    const shared = other.subtract(N.multiply(this.w)).multiply(this.scalar)
    if (shared.is0()) throw new Error('ponto inválido')
    const wHex = this.w.toString(16).padStart(64, '0')
    const wBytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) wBytes[i] = parseInt(wHex.slice(i * 2, i * 2 + 2), 16)
    const transcript = lengthPrefixed(enc.encode('argus-pair-v1'), enc.encode(this.code.nameplate), this.message, theirs, shared.toBytes(), wBytes)
    const keys = await hkdf(await sha256(transcript), new Uint8Array(0), enc.encode('argus-pair-v1 keys'), 96)
    return {
      key: keys.subarray(0, 32),
      myConfirm: await hmac(keys.subarray(32, 64), transcript),
      theirConfirm: await hmac(keys.subarray(64, 96), transcript)
    }
  }
}

export async function directionKeys(secret: Uint8Array, label: string): Promise<{ clientToHost: Uint8Array; hostToClient: Uint8Array }> {
  const k = await hkdf(secret, new Uint8Array(0), enc.encode(`argus ${label} transport`), 64)
  return { clientToHost: k.subarray(0, 32), hostToClient: k.subarray(32, 64) }
}

export function devicePsk(pairKey: Uint8Array): Promise<Uint8Array> {
  return hkdf(pairKey, new Uint8Array(0), enc.encode('argus-pair-v1 device psk'), 32)
}

// --- Cada conexão: X25519 + psk ---

export type Ephemeral = { publicKey: Uint8Array; secretKey: Uint8Array }

export function newEphemeral(): Ephemeral {
  const secretKey = x25519.utils.randomSecretKey()
  return { publicKey: x25519.getPublicKey(secretKey), secretKey }
}

export async function sessionKeys(args: {
  mine: Ephemeral
  theirPublic: Uint8Array
  psk: Uint8Array
  deviceId: string
  clientPublic: Uint8Array
  clientNonce: Uint8Array
  hostPublic: Uint8Array
  hostNonce: Uint8Array
}): Promise<{ clientToHost: Uint8Array; hostToClient: Uint8Array; clientConfirm: Uint8Array; hostConfirm: Uint8Array }> {
  if (args.theirPublic.length !== 32) throw new Error('chave inválida')
  const shared = x25519.getSharedSecret(args.mine.secretKey, args.theirPublic)
  if (shared.every((b) => b === 0)) throw new Error('chave inválida')
  const transcript = await sha256(
    lengthPrefixed(enc.encode('argus-session-v1'), enc.encode(args.deviceId), args.clientPublic, args.clientNonce, args.hostPublic, args.hostNonce)
  )
  const k = await hkdf(shared, args.psk, concat(enc.encode('argus-session-v1 keys'), transcript), 128)
  return {
    clientToHost: k.subarray(0, 32),
    hostToClient: k.subarray(32, 64),
    clientConfirm: await hmac(k.subarray(64, 96), transcript),
    hostConfirm: await hmac(k.subarray(96, 128), transcript)
  }
}

// --- Mensagens cifradas ---

const CHUNK = 256 * 1024
const MAX_MESSAGE = 64 * 1024 * 1024

function nonce(counter: bigint): Uint8Array<ArrayBuffer> {
  const n = new Uint8Array(12)
  new DataView(n.buffer).setBigUint64(4, counter, false)
  return n
}

// Ligação cifrada por cima da crua. A WebCrypto é assíncrona: cifrar e decifrar vão numa fila, na
// ordem em que chegam (o contador de cada sentido depende disso). Quem recebe já fica escutando
// agora, antes de as chaves ficarem prontas: nada que chegue nesse meio-tempo se perde.
export function secureLink(raw: Link, sendKey: Uint8Array, receiveKey: Uint8Array): Link {
  const skReady = subtle().importKey('raw', own(sendKey), 'AES-GCM', false, ['encrypt'])
  const rkReady = subtle().importKey('raw', own(receiveKey), 'AES-GCM', false, ['decrypt'])
  let sendCounter = 0n
  let receiveCounter = 0n
  let sending: Promise<unknown> = Promise.resolve()
  let receiving: Promise<unknown> = Promise.resolve()
  let parts: Uint8Array[] = []
  let size = 0
  let broken = false
  const listeners: ((d: Uint8Array) => void)[] = []

  const fail = (why: string) => {
    if (broken) return
    broken = true
    console.warn(`[argus] ${why}; ligação encerrada`)
    raw.close()
  }

  raw.onMessage((data) => {
    const counter = receiveCounter++
    receiving = receiving.then(async () => {
      if (broken) return
      let plain: Uint8Array
      try {
        if (data.length < 17) throw new Error('curta')
        plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: nonce(counter), tagLength: 128 }, await rkReady, own(data)))
      } catch {
        return fail('mensagem cifrada inválida')
      }
      if (plain.length < 1 || plain[0] > 1) return fail('mensagem cifrada inválida')
      parts.push(plain.subarray(1))
      size += plain.length - 1
      if (size > MAX_MESSAGE) return fail('mensagem grande demais')
      if (plain[0] === 1) return
      const message = parts.length === 1 ? parts[0] : concat(...parts)
      parts = []
      size = 0
      for (const cb of listeners) cb(message)
    })
  })

  const sealAndSend = (frame: Uint8Array) => {
    const counter = sendCounter++
    sending = sending.then(async () => {
      if (broken) return
      const sealed = await subtle().encrypt({ name: 'AES-GCM', iv: nonce(counter), tagLength: 128 }, await skReady, own(frame))
      raw.send(new Uint8Array(sealed))
    })
  }

  return {
    send: (data) => {
      for (let at = 0; at < data.length || at === 0; at += CHUNK) {
        const end = Math.min(at + CHUNK, data.length)
        sealAndSend(concat(new Uint8Array([end < data.length ? 1 : 0]), data.subarray(at, end)))
        if (end >= data.length) break
      }
    },
    onMessage: (cb) => void listeners.push(cb),
    // O fechamento chega depois do que já veio: o de casa entrega a última mensagem e fecha na hora,
    // e a decifragem aqui é assíncrona (sem esperar, o "fechou" passaria na frente da mensagem).
    onClose: (cb) => raw.onClose(() => void receiving.then(cb, cb)),
    close: () => raw.close()
  }
}
