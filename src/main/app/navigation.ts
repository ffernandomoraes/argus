import { shell, type WebContents } from 'electron'
import { isAppUrl } from './appUrl'

// O que a janela pode abrir. O preload dá à página o `window.api` (gravar arquivo, abrir terminal):
// se a janela navegasse para um site, o site ganharia tudo isso. Por isso o quadro principal só
// fica no próprio app, e links abrem fora.

// Esquemas que vão para o sistema: o navegador (http, https) e o app de e-mail (mailto).
const EXTERNAL = new Set(['http:', 'https:', 'mailto:'])

function opensOutside(url: string): boolean {
  try {
    return EXTERNAL.has(new URL(url).protocol)
  } catch {
    return false
  }
}

// Links das conversas abrem no navegador do sistema (os de e-mail, no app de e-mail), não numa
// janela do app.
export function openLinksOutside(wc: WebContents): void {
  wc.setWindowOpenHandler(({ url }) => {
    // Sem app para o esquema (nenhum app de e-mail, por exemplo), o sistema recusa: só registra.
    if (opensOutside(url)) shell.openExternal(url).catch((err: unknown) => console.warn('[links] não abriu:', err))
    return { action: 'deny' }
  })
}

// O quadro principal não sai do app (link sem target, arquivo solto na janela, a página do
// protótipo mexendo em window.top). O iframe do protótipo navega livre: não é o quadro principal.
// <webview> nunca entra.
export function lockNavigation(wc: WebContents): void {
  wc.on('will-navigate', (e) => {
    if (!isAppUrl(e.url)) e.preventDefault()
  })
  wc.on('will-frame-navigate', (e) => {
    if (e.isMainFrame && !isAppUrl(e.url)) e.preventDefault()
  })
  wc.on('will-attach-webview', (e) => e.preventDefault())
}
