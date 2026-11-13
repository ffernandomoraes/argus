// Login do painel: a tela /login confere a senha (DASHBOARD_PASSWORD) e deixa um cookie de sessão
// assinado. Tela própria, e não a janela de senha do navegador, para o gerenciador de senhas
// oferecer salvar e preencher.
//
// A sessão é "<validade>.<assinatura>": HMAC-SHA256 da validade com a própria senha como chave.
// Trocar a senha (wrangler secret put) derruba todas as sessões abertas.

export const SESSION_COOKIE = 'argus_session'
const SESSION_DAYS = 30
// Senha errada demora um pouco para responder: tentar muitas fica lento.
const FAIL_DELAY_MS = 700

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparação sem atalho: o tempo da resposta não diz quantas letras estavam certas.
async function same(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode('argus-dashboard:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function cookieValue(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

export async function hasSession(req: Request, secret: string | undefined, now = Date.now()): Promise<boolean> {
  if (!secret) return false
  const value = cookieValue(req, SESSION_COOKIE)
  if (!value) return false
  const [exp, sig] = value.split('.')
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false
  return same(sig, await sign(secret, exp))
}

export async function checkPassword(typed: string, secret: string | undefined): Promise<boolean> {
  const ok = !!secret && !!typed && (await same(typed, secret))
  if (!ok) await new Promise((r) => setTimeout(r, FAIL_DELAY_MS))
  return ok
}

// Só o servidor lê (HttpOnly), só vai por HTTPS (Secure) e não vai em pedidos vindos de outros sites.
export async function sessionCookie(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_DAYS * 86_400_000)
  const value = `${exp}.${await sign(secret, exp)}`
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_DAYS * 86_400}; HttpOnly; Secure; SameSite=Strict`
}

export const clearedCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
