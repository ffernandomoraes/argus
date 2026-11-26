import type { Response } from 'express';

import type { Lang } from './desktop.codes';
import { DM_SANS_WOFF2, LOGO_SVG } from './desktop.pageAssets';

// A página que o navegador mostra no fim do login (o app manda para cá depois de receber a volta),
// no idioma do app. Os textos são fixos e podem ter <strong> (vão direto para o HTML).

// linked e installed: o GitHub conectado e os repositórios escolhidos (ver modules/github). phone: o
// login do app do celular instalado, que espera o fim do login (ver sendConfirmPage).
export type DoneStatus = 'ok' | 'phone' | 'denied' | 'expired' | 'error' | 'linked' | 'installed';

const TEXT: Record<DoneStatus, Record<Lang, [string, string]>> = {
  ok: {
    pt: ['Você entrou no Argus', 'Pode fechar esta aba e voltar ao app.'],
    en: ["You're signed in to Argus", 'You can close this tab and go back to the app.'],
  },
  phone: {
    pt: ['Você entrou no Argus', 'Volte ao <strong>app do Argus</strong> no celular: ele entra sozinho.'],
    en: ["You're signed in to Argus", 'Go back to the <strong>Argus app</strong> on your phone: it signs in by itself.'],
  },
  denied: {
    pt: ['Login cancelado', 'Volte ao Argus se quiser tentar de novo.'],
    en: ['Sign-in canceled', 'Go back to Argus if you want to try again.'],
  },
  expired: {
    pt: ['O login demorou demais', 'Volte ao Argus e clique em entrar de novo.'],
    en: ['Sign-in took too long', 'Go back to Argus and click sign in again.'],
  },
  linked: {
    pt: ['GitHub conectado', 'Pode fechar esta aba e voltar ao Argus.'],
    en: ['GitHub connected', 'You can close this tab and go back to Argus.'],
  },
  installed: {
    pt: ['Repositórios liberados', 'Volte ao Argus: eles aparecem em <strong>Nova pasta › Clonar do GitHub</strong>.'],
    en: ['Repositories allowed', 'Go back to Argus: they show up in <strong>New folder › Clone from GitHub</strong>.'],
  },
  error: {
    pt: ['Não deu para entrar', 'Volte ao Argus e tente de novo daqui a pouco.'],
    en: ["Couldn't sign you in", 'Go back to Argus and try again in a moment.'],
  },
};

const STATUSES: readonly DoneStatus[] = ['ok', 'phone', 'denied', 'expired', 'error', 'linked', 'installed'];
export const isDoneStatus = (v: unknown): v is DoneStatus => STATUSES.includes(v as DoneStatus);

type Tone = 'ok' | 'warn' | 'error';

const TONE: Record<DoneStatus, Tone> = {
  ok: 'ok',
  phone: 'ok',
  linked: 'ok',
  installed: 'ok',
  denied: 'warn',
  expired: 'warn',
  error: 'error',
};

// Ícones do status (traço, 24x24): certo, relógio/aviso e erro.
const ICONS: Record<Tone, string> = {
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  warn: '<path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>',
  error: '<path d="M7.5 7.5l9 9"/><path d="M16.5 7.5l-9 9"/>',
};

const STYLE = `
  @font-face { font-family: "DM Sans"; src: url(data:font/woff2;base64,${DM_SANS_WOFF2}) format("woff2"); font-weight: 400 700; }
  :root { color-scheme: light dark;
    --bg: #f4f4f5; --card: #fff; --line: rgba(0,0,0,.07); --text: #18181b; --muted: #63636b;
    --ok: #1f9d55; --ok-bg: rgba(31,157,85,.12); --warn: #c27803; --warn-bg: rgba(194,120,3,.12);
    --error: #d93636; --error-bg: rgba(217,54,54,.11); }
  @media (prefers-color-scheme: dark) { :root {
    --bg: #101010; --card: #1a1a1a; --line: #262626; --text: #f4f4f5; --muted: #a1a1aa;
    --ok: #4ade80; --ok-bg: rgba(74,222,128,.12); --warn: #fbbf24; --warn-bg: rgba(251,191,36,.12);
    --error: #f87171; --error-bg: rgba(248,113,113,.12); } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 28px; padding: 24px 16px; background: var(--bg); color: var(--text);
    font: 400 16px/1.55 "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased; }
  .logo { display: block; height: 36px; width: auto; color: var(--text); }
  .logo .mark { fill: currentColor; }
  main { width: 100%; max-width: 420px; padding: 36px 32px 32px; border-radius: 20px; background: var(--card);
    border: 1px solid var(--line); text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 12px 32px rgba(0,0,0,.06); }
  .icon { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; margin-bottom: 20px; }
  .icon svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round;
    stroke-linejoin: round; }
  .icon.ok { color: var(--ok); background: var(--ok-bg); }
  .icon.warn { color: var(--warn); background: var(--warn-bg); }
  .icon.error { color: var(--error); background: var(--error-bg); }
  h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -.02em; }
  p { margin: 0; color: var(--muted); font-size: 16px; text-wrap: pretty; }
  strong { color: var(--text); font-weight: 600; white-space: nowrap; }
  footer { font-size: 14px; color: var(--muted); }
  .code { margin: 20px 0 24px; font: 700 30px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; color: var(--text); }
  button { width: 100%; padding: 13px 16px; border: 0; border-radius: 999px; background: var(--text); color: var(--card);
    font-family: inherit; font-size: 16px; font-weight: 600; line-height: 1.2; cursor: pointer; }
  button:active { opacity: .7; }
`;

export function sendDonePage(res: Response, status: DoneStatus, lang: Lang): void {
  const [title, hint] = TEXT[status][lang];
  const tone = TONE[status];
  sendPage(res, status === 'error' ? 400 : 200, lang, { title, body: `
  <span class="icon ${tone}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[tone]}</svg></span>
  <h1>${title}</h1>
  <p>${hint}</p>` });
}

// Login do app do celular instalado, já de volta do GitHub ou do Google: antes de liberar, mostra o
// código que o app está mostrando e pede para confirmar. Sem isso, um link de login mandado por outra
// pessoa daria a conta de quem clicou ao app de quem mandou. O formulário manda para o mesmo endereço.
export function sendConfirmPage(res: Response, lang: Lang, code: string): void {
  const [title, hint, button] =
    lang === 'pt'
      ? ['Entrar no app do celular?', 'Confira se o app do Argus no seu celular mostra este código. Se não mostra, feche esta página.', 'Confirmar e entrar']
      : ['Sign in to the phone app?', 'Check that the Argus app on your phone shows this code. If it doesn\'t, close this page.', 'Confirm and sign in'];
  // Só este formulário manda para o próprio servidor; o resto da CSP continua a de todas as páginas.
  res.set('Content-Security-Policy', String(res.get('Content-Security-Policy')).replace("form-action 'none'", "form-action 'self'"));
  sendPage(res, 200, lang, { title, body: `
  <h1>${title}</h1>
  <p>${hint}</p>
  <div class="code">${code}</div>
  <form method="post"><button type="submit">${button}</button></form>` });
}

function sendPage(res: Response, httpStatus: number, lang: Lang, { title, body }: { title: string; body: string }): void {
  res
    .status(httpStatus)
    .type('html')
    .set('Cache-Control', 'no-store')
    .send(`<!doctype html>
<html lang="${lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Argus</title>
<style>${STYLE}</style>
</head>
<body>
${LOGO_SVG.replace('<svg ', '<svg class="logo" role="img" aria-label="Argus" ')}
<main>${body}
</main>
<footer>argusterm.com</footer>
</body>
</html>`);
}
