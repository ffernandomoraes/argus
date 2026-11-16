import { shell, type WebContents } from 'electron';
import { sendTo } from '../ipc/events';
import { remoteClientOf } from '../remote/client';
import { loopbackPort, onLocalPort } from '../remote/localhostLink';
import { isAppUrl } from './appUrl';

// O que a janela pode abrir. O preload dá à página o `window.api` (gravar arquivo, abrir terminal):
// se a janela navegasse para um site, o site ganharia tudo isso. Por isso o quadro principal só
// fica no próprio app, e links abrem fora.

// Esquemas que vão para o sistema: o navegador (http, https) e o app de e-mail (mailto).
const EXTERNAL = new Set(['http:', 'https:', 'mailto:']);

function opensOutside(url: string): boolean {
  try {
    return EXTERNAL.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

const openOutside = (url: string) => shell.openExternal(url).catch((err: unknown) => console.warn('[links] não abriu:', err));

// Links das conversas abrem no navegador do sistema (os de e-mail, no app de e-mail), não numa
// janela do app.
export function openLinksOutside(wc: WebContents): void {
  wc.setWindowOpenHandler(({ url }) => {
    // Sem app para o esquema (nenhum app de e-mail, por exemplo), o sistema recusa: só registra.
    if (!opensOutside(url)) return { action: 'deny' };
    if (!openRemoteLocalhost(wc, url)) void openOutside(url);
    return { action: 'deny' };
  });
}

// Janela de acesso remoto: link para o localhost é do servidor do outro computador. Abre pelo túnel,
// na porta daqui que leva à de lá (a mesma, se estava livre). Falso: não é o caso, abre como sempre.
function openRemoteLocalhost(wc: WebContents, url: string): boolean {
  const client = remoteClientOf(wc.id);
  const port = client && loopbackPort(url);
  if (!client || !port) return false;
  client
    .openLocalhost(wc.id, port)
    .then((local) => {
      if (local !== port) sendTo(wc, 'remote:portMoved', port, local);
      return openOutside(onLocalPort(url, local));
    })
    .catch((err: unknown) => console.warn('[links] localhost de lá não abriu:', err));
  return true;
}

// O quadro principal não sai do app (link sem target, arquivo solto na janela, um iframe
// mexendo em window.top). Um iframe navega livre: não é o quadro principal.
// <webview> nunca entra.
export function lockNavigation(wc: WebContents): void {
  wc.on('will-navigate', (e) => {
    if (!isAppUrl(e.url)) e.preventDefault();
  });
  wc.on('will-frame-navigate', (e) => {
    if (e.isMainFrame && !isAppUrl(e.url)) e.preventDefault();
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
}
