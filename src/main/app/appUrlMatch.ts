import { posix, win32 } from 'node:path'
import { fileURLToPath } from 'node:url'

// De onde a interface do app carrega: o servidor do Vite no pnpm dev, ou o index.html empacotado.
export type RendererEntry = { dev: string } | { file: string }

// O endereço é o do próprio app? No pnpm dev vale a origem do Vite (qualquer caminho e #rota); no
// instalado, o index.html do app em file://, com qualquer #rota. Sem Electron, para dar para testar.
// windows: compara os caminhos como no Windows (barras invertidas, sem diferença de maiúsculas).
export function matchesAppUrl(url: string, entry: RendererEntry, windows: boolean): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  if ('dev' in entry) {
    try {
      return target.origin === new URL(entry.dev).origin
    } catch {
      return false
    }
  }
  if (target.protocol !== 'file:') return false
  let path: string
  try {
    // O caminho sai sem a #rota e sem os %XX (espaços e acentos no nome das pastas).
    path = fileURLToPath(target, { windows })
  } catch {
    return false
  }
  const p = windows ? win32 : posix
  const a = p.normalize(path)
  const b = p.normalize(entry.file)
  return windows ? a.toLowerCase() === b.toLowerCase() : a === b
}
