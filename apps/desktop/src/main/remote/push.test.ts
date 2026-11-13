import { createPublicKey, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encryptPush, newPushKeys, vapidAuthorization } from './push'

const b = (s: string) => Buffer.from(s, 'base64url')

// Exemplo do Apêndice A do RFC 8291.
const RFC = {
  plain: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'
}

describe('Web Push', () => {
  it('cifra igual ao exemplo do RFC 8291', () => {
    const out = encryptPush(b(RFC.plain), { p256dh: RFC.uaPublic, auth: RFC.auth }, { privateKey: b(RFC.asPrivate) }, b(RFC.salt))
    // O cabeçalho tem 86 bytes (não múltiplo de 3): compara os bytes, não o texto emendado.
    expect(out.subarray(0, 86).toString('base64url')).toBe(RFC.header)
    expect(out.subarray(86).toString('base64url')).toBe(RFC.ciphertext)
  })

  it('assina o VAPID com a chave pública que manda junto', () => {
    const keys = newPushKeys()
    const auth = vapidAuthorization('https://web.push.apple.com/abc', keys, 'https://example.com', 1_700_000_000_000)
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(auth)
    expect(m).not.toBeNull()
    const [, header, claims, signature, k] = m!
    expect(k).toBe(keys.publicKey)
    expect(JSON.parse(b(claims).toString())).toEqual({ aud: 'https://web.push.apple.com', exp: 1_700_000_000 + 12 * 3600, sub: 'https://example.com' })
    const raw = b(k)
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' })
    expect(verify('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, b(signature))).toBe(true)
  })
})
