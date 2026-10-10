import { git } from './git'
import { findRepo } from './repo'

// Endereço do remoto (o origin; sem ele, o primeiro) em forma de página web. O SSH
// (git@github.com:dono/repo.git ou ssh://git@host/dono/repo) vira https. Pasta fora de
// repositório, sem remoto ou com remoto local: nulo.
export async function repoUrl(folder: string): Promise<string | null> {
  const repo = findRepo(folder)
  if (!repo) return null
  try {
    const remotes = (await git(repo.root, ['remote'])).trim().split(/\r?\n/).filter(Boolean)
    const name = remotes.includes('origin') ? 'origin' : remotes[0]
    if (!name) return null
    return toWebUrl((await git(repo.root, ['remote', 'get-url', name])).trim())
  } catch {
    return null
  }
}

export function toWebUrl(remote: string): string | null {
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(remote)
  const raw = scp ? `https://${scp[1]}/${scp[2]}` : remote.replace(/^(ssh|git):\/\//, 'https://')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    // Usuário e token do remoto não vão para o navegador; a porta do SSH também não vale no https.
    url.username = ''
    url.password = ''
    if (/^(ssh|git):/.test(remote)) url.port = ''
    url.pathname = url.pathname.replace(/\.git\/?$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}
