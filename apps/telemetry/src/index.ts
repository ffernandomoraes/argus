import DASHBOARD_HTML from './dashboard.html'
import { buildSummary } from './summary'
import { validate } from './validate'

// Dados de uso anônimos do Argus. O app (apps/desktop/src/main/telemetry) manda um resumo por dia em
// POST /v1/report; o painel (GET /) lê os números somados em GET /api/summary. Painel e números
// pedem a senha DASHBOARD_PASSWORD (login do navegador, usuário qualquer); sem ela configurada,
// ficam fechados.

interface Env {
  DB: D1Database
  DASHBOARD_PASSWORD?: string
}

// Um resumo tem poucos KB; mais que isso não é do app.
const MAX_BODY = 64 * 1024
const PERIODS = [7, 30, 90]

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

// Comparação sem atalho: o tempo da resposta não diz quantas letras da senha estavam certas.
async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))])
  const x = new Uint8Array(ha)
  const y = new Uint8Array(hb)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

async function authorized(req: Request, env: Env): Promise<boolean> {
  const secret = env.DASHBOARD_PASSWORD
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  if (!header.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = atob(header.slice(6))
  } catch {
    return false
  }
  const password = decoded.slice(decoded.indexOf(':') + 1)
  return sameSecret(password, secret)
}

const askLogin = () =>
  new Response('Senha necessária.', { status: 401, headers: { 'www-authenticate': 'Basic realm="Argus", charset="UTF-8"', 'cache-control': 'no-store' } })

async function receive(req: Request, env: Env): Promise<Response> {
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_BODY) return json({ error: 'too large' }, 413)
  const text = await req.text()
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const r = validate(body)
  if (!r) return json({ error: 'invalid report' }, 400)
  await env.DB.prepare(
    `INSERT INTO reports (install_id, day, received_at, app_version, os, os_version, arch, language, active_minutes, payload)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (install_id, day) DO UPDATE SET
       received_at = excluded.received_at, app_version = excluded.app_version, os = excluded.os,
       os_version = excluded.os_version, arch = excluded.arch, language = excluded.language,
       active_minutes = excluded.active_minutes, payload = excluded.payload`
  )
    .bind(r.installId, r.day, Date.now(), r.app.version, r.app.os, r.app.osVersion, r.app.arch, r.app.language, r.time.activeMinutes, JSON.stringify(r))
    .run()
  return new Response(null, { status: 204 })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/v1/report') {
      if (req.method !== 'POST') return new Response(null, { status: 405 })
      return receive(req, env)
    }
    if (req.method !== 'GET') return new Response(null, { status: 405 })
    if (url.pathname === '/' || url.pathname === '/api/summary') {
      if (!(await authorized(req, env))) return askLogin()
      if (url.pathname === '/') {
        return new Response(DASHBOARD_HTML, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'content-security-policy':
              "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; img-src data:",
            'x-frame-options': 'DENY',
            'referrer-policy': 'no-referrer'
          }
        })
      }
      const days = Number(url.searchParams.get('days'))
      return json(await buildSummary(env.DB, PERIODS.includes(days) ? days : 30))
    }
    return new Response('Not found', { status: 404 })
  }
}
