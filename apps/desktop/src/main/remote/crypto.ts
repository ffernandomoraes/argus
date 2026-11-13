import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  diffieHellman,
  generateKeyPairSync,
  createPublicKey,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
  type KeyObject
} from 'node:crypto'
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js'
import type { Link } from './link'

// Criptografia do acesso remoto. A ponte na internet só repassa bytes: tudo o que passa por ela vai
// cifrado e autenticado de ponta a ponta, e nada do que ela vê permite se passar por um dos lados.
//
// Pareamento (uma vez por aparelho): SPAKE2 sobre ristretto255 com a parte secreta do código
// (6 dígitos). Quem não sabe o código tem uma tentativa por pareamento (o de casa encerra o
// pareamento no primeiro erro) e nada para testar fora da conversa. Da chave combinada sai uma
// chave secreta do aparelho (`psk`), guardada nos dois lados.
//
// Cada conexão depois disso: chaves X25519 novas dos dois lados (o que passou fica protegido mesmo
// se a psk vazar depois), misturadas com a psk (só o aparelho pareado conecta) e confirmadas pelos
// dois antes de qualquer pedido. As mensagens vão em AES-256-GCM, com um contador por
// sentido como nonce (mensagem repetida, fora de ordem ou alterada derruba a ligação).

const enc = new TextEncoder()
const Point = ristretto255.Point

// --- Peças ---

function lengthPrefixed(...parts: Uint8Array[]): Buffer {
  const out: Buffer[] = []
  for (const p of parts) {
    const len = Buffer.alloc(8)
    len.writeBigUInt64LE(BigInt(p.length))
    out.push(len, Buffer.from(p))
  }
  return Buffer.concat(out)
}

const sha256 = (data: Uint8Array): Buffer => createHash('sha256').update(data).digest()
const hmac = (key: Uint8Array, data: Uint8Array): Buffer => createHmac('sha256', key).update(data).digest()

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Buffer {
  return Buffer.from(hkdfSync('sha256', ikm, salt, info, length))
}

// Escalar aleatório e uniforme no grupo (64 bytes reduzidos, sem viés), nunca zero.
function randomScalar(): bigint {
  for (;;) {
    const s = ristretto255_hasher.hashToScalar(randomBytes(64), { DST: 'argus-remote-v1-random' })
    if (s !== 0n) return s
  }
}

// --- Pareamento: SPAKE2 ---

// M e N: pontos públicos de logaritmo desconhecido, tirados do hash de um texto fixo (ninguém sabe
// a relação deles com o gerador, que é o que o SPAKE2 exige).
const DST = 'argus-remote-v1-spake2'
const M = ristretto255_hasher.hashToCurve(enc.encode('argus spake2 M'), { DST })
const N = ristretto255_hasher.hashToCurve(enc.encode('argus spake2 N'), { DST })

export type PairRole = 'client' | 'host'

// O código mostrado no computador de casa: "K7Q4M-913776". A primeira parte (nameplate) é o
// endereço do pareamento na ponte: 5 letras e números (33 milhões de combinações), para ninguém
// conseguir varrer as vagas e entrar antes de quem pareia. A segunda (senha, 6 dígitos) nunca sai
// dos dois computadores.
export type PairCode = { nameplate: string; secret: string }

// Base32 de Crockford: sem I, L, O e U, que se confundem com 1, 0 e V.
const NAMEPLATE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const NAMEPLATE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}$/

export function newPairCode(): PairCode {
  // 32 letras: cada byte vira uma pelos 5 bits de baixo, sem viés.
  const nameplate = Array.from(randomBytes(5), (b) => NAMEPLATE_ALPHABET[b & 31]).join('')
  // Dígitos: byte de 250 a 255 é descartado; com ele, de 0 a 5 sairiam um pouco mais.
  let secret = ''
  while (secret.length < 6) {
    const b = randomBytes(1)[0]
    if (b < 250) secret += String(b % 10)
  }
  return { nameplate, secret }
}

export const formatPairCode = (c: PairCode) => `${c.nameplate}-${c.secret}`

// Aceita minúsculas, espaços, hífens e pontos ("k7q4m 913 776"); O vira 0 e I/L viram 1, como no
// Crockford (quem lê o código em voz alta não erra por isso).
export function parsePairCode(text: string): PairCode | null {
  const only = text.toUpperCase().replace(/[\s.-]/g, '')
  if (only.length !== 11) return null
  const nameplate = only.slice(0, 5).replace(/O/g, '0').replace(/[IL]/g, '1')
  const secret = only.slice(5)
  return NAMEPLATE_PATTERN.test(nameplate) && /^\d{6}$/.test(secret) ? { nameplate, secret } : null
}

export class Spake2 {
  private readonly scalar = randomScalar()
  private readonly w: bigint
  private readonly mine: Uint8Array

  constructor(
    private readonly role: PairRole,
    private readonly code: PairCode
  ) {
    this.w = ristretto255_hasher.hashToScalar(lengthPrefixed(enc.encode('argus-pair-v1'), enc.encode(code.nameplate), enc.encode(code.secret)), { DST })
    const blind = role === 'client' ? M : N
    this.mine = Point.BASE.multiply(this.scalar).add(blind.multiply(this.w)).toBytes()
  }

  // A mensagem deste lado (o ponto mascarado pela senha).
  get message(): Uint8Array {
    return this.mine
  }

  // Com a mensagem do outro lado: a chave combinada e as confirmações. Ponto inválido ou neutro
  // é recusado (lança).
  finish(theirs: Uint8Array): { key: Buffer; myConfirm: Buffer; theirConfirm: Buffer } {
    const other = Point.fromBytes(theirs)
    if (other.is0()) throw new Error('ponto inválido')
    const unblind = this.role === 'client' ? N : M
    const shared = other.subtract(unblind.multiply(this.w)).multiply(this.scalar)
    if (shared.is0()) throw new Error('ponto inválido')
    const [x, y] = this.role === 'client' ? [this.mine, theirs] : [theirs, this.mine]
    const wBytes = Buffer.from(this.w.toString(16).padStart(64, '0'), 'hex')
    const transcript = lengthPrefixed(enc.encode('argus-pair-v1'), enc.encode(this.code.nameplate), x, y, shared.toBytes(), wBytes)
    const keys = hkdf(sha256(transcript), Buffer.alloc(0), enc.encode('argus-pair-v1 keys'), 96)
    const [key, confirmClient, confirmHost] = [keys.subarray(0, 32), keys.subarray(32, 64), keys.subarray(64, 96)]
    const tag = (k: Buffer) => hmac(k, transcript)
    return this.role === 'client'
      ? { key, myConfirm: tag(confirmClient), theirConfirm: tag(confirmHost) }
      : { key, myConfirm: tag(confirmHost), theirConfirm: tag(confirmClient) }
  }
}

// Chaves de transporte a partir de um segredo combinado: uma por sentido.
export function directionKeys(secret: Uint8Array, label: string): { clientToHost: Buffer; hostToClient: Buffer } {
  const k = hkdf(secret, Buffer.alloc(0), enc.encode(`argus ${label} transport`), 64)
  return { clientToHost: k.subarray(0, 32), hostToClient: k.subarray(32, 64) }
}

// A chave do aparelho pareado, derivada do pareamento (os dois lados chegam à mesma).
export function devicePsk(pairKey: Uint8Array): Buffer {
  return hkdf(pairKey, Buffer.alloc(0), enc.encode('argus-pair-v1 device psk'), 32)
}

// --- Cada conexão: X25519 + psk ---

export type Ephemeral = { publicKey: Buffer; privateKey: KeyObject }

export function newEphemeral(): Ephemeral {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  const raw = publicKey.export({ format: 'jwk' }).x
  if (!raw) throw new Error('chave X25519 sem formato')
  return { publicKey: Buffer.from(raw, 'base64url'), privateKey }
}

function x25519(mine: KeyObject, theirs: Uint8Array): Buffer {
  if (theirs.length !== 32) throw new Error('chave inválida')
  const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: Buffer.from(theirs).toString('base64url') }, format: 'jwk' })
  const shared = diffieHellman({ privateKey: mine, publicKey })
  // Chave de ordem baixa dá segredo zerado: recusada.
  if (shared.every((b) => b === 0)) throw new Error('chave inválida')
  return shared
}

export type SessionKeys = {
  clientToHost: Buffer
  hostToClient: Buffer
  clientConfirm: Buffer
  hostConfirm: Buffer
}

// Os dois lados chamam com os mesmos valores (o seu par efêmero e a chave pública do outro).
export function sessionKeys(
  args: { mine: Ephemeral; theirPublic: Uint8Array; psk: Uint8Array; deviceId: string; clientPublic: Uint8Array; clientNonce: Uint8Array; hostPublic: Uint8Array; hostNonce: Uint8Array }
): SessionKeys {
  const shared = x25519(args.mine.privateKey, args.theirPublic)
  const transcript = sha256(
    lengthPrefixed(enc.encode('argus-session-v1'), enc.encode(args.deviceId), args.clientPublic, args.clientNonce, args.hostPublic, args.hostNonce)
  )
  const k = hkdf(shared, args.psk, Buffer.concat([enc.encode('argus-session-v1 keys'), transcript]), 128)
  const confirm = (key: Buffer) => hmac(key, transcript)
  return {
    clientToHost: k.subarray(0, 32),
    hostToClient: k.subarray(32, 64),
    clientConfirm: confirm(k.subarray(64, 96)),
    hostConfirm: confirm(k.subarray(96, 128))
  }
}

export { sameBytes }

// --- Mensagens cifradas ---

// Mensagem grande (uma imagem do histórico, por exemplo) vai em pedaços: a ponte limita o tamanho
// de cada mensagem. Primeiro byte de cada pedaço: 1 = vem mais, 0 = último.
const CHUNK = 256 * 1024
// Uma mensagem montada nunca passa disto (protege a memória de quem recebe).
const MAX_MESSAGE = 64 * 1024 * 1024

function nonce(counter: bigint): Buffer {
  const n = Buffer.alloc(12)
  n.writeBigUInt64BE(counter, 4)
  return n
}

// Uma ligação cifrada por cima de outra (a que passa pela ponte). Falha de autenticação ou
// mensagem fora do formato fecha a ligação.
export function secureLink(raw: Link, sendKey: Uint8Array, receiveKey: Uint8Array): Link {
  let sendCounter = 0n
  let receiveCounter = 0n
  let parts: Buffer[] = []
  let size = 0
  const messageListeners: ((d: Buffer) => void)[] = []

  const seal = (plain: Buffer): Buffer => {
    const cipher = createCipheriv('aes-256-gcm', sendKey, nonce(sendCounter++), { authTagLength: 16 })
    return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()])
  }

  const open = (sealed: Buffer): Buffer | null => {
    if (sealed.length < 17) return null
    try {
      const decipher = createDecipheriv('aes-256-gcm', receiveKey, nonce(receiveCounter++), { authTagLength: 16 })
      decipher.setAuthTag(sealed.subarray(sealed.length - 16))
      return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()])
    } catch {
      return null
    }
  }

  raw.onMessage((data) => {
    const plain = open(data)
    if (!plain || plain.length < 1 || plain[0] > 1) {
      console.warn('[remoto] mensagem cifrada inválida; ligação encerrada')
      return raw.close()
    }
    parts.push(plain.subarray(1))
    size += plain.length - 1
    if (size > MAX_MESSAGE) {
      console.warn('[remoto] mensagem grande demais; ligação encerrada')
      return raw.close()
    }
    if (plain[0] === 1) return
    const message = parts.length === 1 ? parts[0] : Buffer.concat(parts)
    parts = []
    size = 0
    for (const cb of messageListeners) cb(message)
  })

  return {
    send: (data) => {
      for (let at = 0; at < data.length || at === 0; at += CHUNK) {
        const end = Math.min(at + CHUNK, data.length)
        raw.send(seal(Buffer.concat([Buffer.from([end < data.length ? 1 : 0]), data.subarray(at, end)])))
        if (end >= data.length) break
      }
    },
    onMessage: (cb) => void messageListeners.push(cb),
    onClose: (cb) => raw.onClose(cb),
    close: () => raw.close()
  }
}
