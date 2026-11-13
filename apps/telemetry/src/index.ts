import { checkPassword, clearedCookie, hasSession, sessionCookie } from './auth';
import DASHBOARD_HTML from './dashboard.html';
import LOGIN_HTML from './login.html';
import { buildSummary } from './summary';
import { validate } from './validate';

// Dados de uso anônimos do Argus. O app (apps/desktop/src/main/telemetry) manda um resumo por dia em
// POST /v1/report; o painel (GET /) lê os números somados em GET /api/summary. Painel e números
// pedem login na tela /login, com a senha DASHBOARD_PASSWORD (ver auth.ts); sem ela configurada,
// ficam fechados.

interface Env {
  DB: D1Database
  DASHBOARD_PASSWORD?: string
}

// Um resumo tem poucos KB; mais que isso não é do app.
const MAX_BODY = 64 * 1024;
const PERIODS = [7, 30, 90];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; form-action 'self'",
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

const redirect = (to: string, cookie?: string) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...(cookie && { 'set-cookie': cookie }) } });

function loginPage(error: string | null, status = 200): Response {
  const html = LOGIN_HTML.replace('<!--ERROR-->', error ? `<p class="error" role="alert">${error}</p>` : '');
  return new Response(html, { status, headers: PAGE_HEADERS });
}

async function login(req: Request, env: Env): Promise<Response> {
  if (!env.DASHBOARD_PASSWORD) return loginPage('O painel está sem senha configurada.', 503);
  let password = '';
  try {
    password = String((await req.formData()).get('password') ?? '');
  } catch {
    // Corpo que não é formulário: vale como senha vazia.
  }
  if (!(await checkPassword(password, env.DASHBOARD_PASSWORD))) return loginPage('Senha incorreta.', 401);
  return redirect('/', await sessionCookie(env.DASHBOARD_PASSWORD));
}

async function receive(req: Request, env: Env): Promise<Response> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return json({ error: 'too large' }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const r = validate(body);
  if (!r) return json({ error: 'invalid report' }, 400);
  await env.DB.prepare(
    `INSERT INTO reports (install_id, day, received_at, app_version, os, os_version, arch, language, active_minutes, payload)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (install_id, day) DO UPDATE SET
       received_at = excluded.received_at, app_version = excluded.app_version, os = excluded.os,
       os_version = excluded.os_version, arch = excluded.arch, language = excluded.language,
       active_minutes = excluded.active_minutes, payload = excluded.payload`,
  )
    .bind(r.installId, r.day, Date.now(), r.app.version, r.app.os, r.app.osVersion, r.app.arch, r.app.language, r.time.activeMinutes, JSON.stringify(r))
    .run();
  return new Response(null, { status: 204 });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/v1/report') {
      if (req.method !== 'POST') return new Response(null, { status: 405 });
      return receive(req, env);
    }
    if (url.pathname === '/login') {
      if (req.method === 'POST') return login(req, env);
      if (req.method !== 'GET') return new Response(null, { status: 405 });
      return (await hasSession(req, env.DASHBOARD_PASSWORD)) ? redirect('/') : loginPage(null);
    }
    if (req.method !== 'GET') return new Response(null, { status: 405 });
    if (url.pathname === '/logout') return redirect('/login', clearedCookie());
    if (url.pathname === '/' || url.pathname === '/api/summary') {
      const ok = await hasSession(req, env.DASHBOARD_PASSWORD);
      if (url.pathname === '/') return ok ? new Response(DASHBOARD_HTML, { headers: PAGE_HEADERS }) : redirect('/login');
      if (!ok) return json({ error: 'login required' }, 401);
      const days = Number(url.searchParams.get('days'));
      return json(await buildSummary(env.DB, PERIODS.includes(days) ? days : 30));
    }
    return new Response('Not found', { status: 404 });
  },
};
