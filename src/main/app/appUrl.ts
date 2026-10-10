import { join } from 'node:path'
import { app } from 'electron'
import { IS_WIN } from '../platform'
import { matchesAppUrl, type RendererEntry } from './appUrlMatch'

// Só o pnpm dev carrega do Vite; o instalado ignora a variável mesmo se ela vier herdada.
export function rendererEntry(): RendererEntry {
  const dev = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']
  return dev ? { dev } : { file: join(__dirname, '../renderer/index.html') }
}

// Guarda a última resposta: quase toda conferência é do mesmo endereço (a janela que manda IPC).
let last: { url: string; ok: boolean } | null = null

// Endereço do próprio app (e não de um site ou da página do protótipo).
export function isAppUrl(url: string | undefined): boolean {
  if (!url) return false
  if (last?.url === url) return last.ok
  const ok = matchesAppUrl(url, rendererEntry(), IS_WIN)
  last = { url, ok }
  return ok
}

// Quadro principal de uma janela do app: só ele fala com o processo principal. A página do
// protótipo (iframe em localhost) e qualquer site fora do app ficam de fora.
export function isAppFrame(frame: Electron.WebFrameMain | null | undefined): boolean {
  try {
    return !!frame && !frame.detached && !frame.parent && isAppUrl(frame.url)
  } catch {
    // Quadro que já saiu da página (recarregou ou fechou): o Electron não deixa nem ler.
    return false
  }
}
