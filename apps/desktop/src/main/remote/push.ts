import { createCipheriv, createECDH, createPrivateKey, generateKeyPairSync, hkdfSync, randomBytes, sign } from 'node:crypto'
import type { WebPushSubscription } from '@argus/shared/webRemote'

// Notificações no celular (Web Push), mandadas daqui direto para o serviço do navegador (Apple,
// Google...), sem passar pela ponte. O conteúdo vai cifrado para o aparelho (RFC 8291): o serviço
// só repassa. Este computador se identifica com um par de chaves próprio (VAPID, RFC 8292), criado
// uma vez e guardado com os pareamentos.

export type PushKeys = { publicKey: string; privateKey: string }

const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url')

export function newPushKeys(): PushKeys {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = publicKey.export({ format: 'jwk' })
  if (!jwk.x || !jwk.y) throw new Error('chave P-256 sem formato')
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])
  return { publicKey: b64url(raw), privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64') }
}

// JWT do VAPID, assinado com ES256, para o serviço do endereço `endpoint`. `subject`: contato do
// remetente (https: ou mailto:), que alguns serviços exigem.
export function vapidAuthorization(endpoint: string, keys: PushKeys, subject: string, now = Date.now()): string {
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })))
  const key = createPrivateKey({ key: Buffer.from(keys.privateKey, 'base64'), format: 'der', type: 'pkcs8' })
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`
}

// Cifra o conteúdo para o aparelho (aes128gcm, um registro só). `local` e `salt` só nos testes.
export function encryptPush(
  plain: Uint8Array,
  sub: Pick<WebPushSubscription, 'p256dh' | 'auth'>,
  local?: { privateKey: Uint8Array },
  salt: Uint8Array = randomBytes(16)
): Buffer {
  const uaPublic = Buffer.from(sub.p256dh, 'base64url')
  const authSecret = Buffer.from(sub.auth, 'base64url')
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('inscrição inválida')
  const ecdh = createECDH('prime256v1')
  if (local) ecdh.setPrivateKey(local.privateKey)
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(uaPublic)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, keyInfo, 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  // 0x02: delimitador do último (e único) registro.
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plain), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])
  const rs = Buffer.alloc(4)
  rs.writeUInt32BE(4096)
  return Buffer.concat([Buffer.from(salt), rs, Buffer.from([asPublic.length]), asPublic, body])
}

// O que a notificação mostra e onde ela abre o app (a parte do endereço depois do #).
export type PushPayload = { title: string; body: string; url: string; tag?: string }

export type PushResult = 'sent' | 'gone' | 'failed'

// Manda uma notificação. 'gone': a inscrição não vale mais (app removido, permissão retirada).
export async function sendPush(sub: WebPushSubscription, payload: PushPayload, keys: PushKeys, subject: string): Promise<PushResult> {
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthorization(sub.endpoint, keys, subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(24 * 3600),
        Urgency: 'high'
      },
      body: new Uint8Array(encryptPush(new TextEncoder().encode(JSON.stringify(payload)), sub)),
      signal: AbortSignal.timeout(15_000)
    })
    if (res.status === 404 || res.status === 410) return 'gone'
    if (!res.ok) {
      console.warn(`[remoto web] notificação recusada (${res.status}):`, (await res.text().catch(() => '')).slice(0, 200))
      return 'failed'
    }
    return 'sent'
  } catch (err) {
    console.warn('[remoto web] notificação não enviada:', err instanceof Error ? err.message : String(err))
    return 'failed'
  }
}
