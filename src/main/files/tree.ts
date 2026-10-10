import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import type { FileEntry } from '../../shared/files'
import { SAFE_GIT } from '../gitBranch/git'
import { writeStdin } from '../lib/childProcess'
import { insideRoot } from '../paths'
import { gitPath } from '../platform'

// Arquivos que o sistema cria sozinho nas pastas (Finder e Explorador do Windows).
const HIDDEN = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini'])

// Quais destes nomes da pasta o .gitignore ignora. O git também responde pelo que está dentro
// de uma pasta ignorada; arquivo já versionado nunca conta. Fora de repositório: nenhum.
function ignoredNames(dir: string, names: string[]): Promise<Set<string>> {
  return new Promise((done) => {
    if (!names.length) return done(new Set())
    const child = execFile(
      gitPath(),
      [...SAFE_GIT, '-C', dir, 'check-ignore', '-z', '--stdin'],
      // O limite padrão (1 MB) cortava a lista de uma pasta grande; sem prazo, um git travado
      // seguraria a árvore para sempre.
      { windowsHide: true, timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
      (_err, stdout) =>
        // Sai com 1 quando nada é ignorado e 128 fora de repositório: os dois viram lista vazia.
        done(new Set(String(stdout ?? '').split('\0').filter(Boolean)))
    )
    // Fora de repositório o git sai antes de ler a lista: sem o ouvinte de erro que o writeStdin
    // põe, o EPIPE de uma pasta com muitos nomes derrubava o processo principal.
    writeStdin(child, names.join('\0') + '\0')
  })
}

export async function listDir(root: string, rel: string): Promise<FileEntry[]> {
  const dir = insideRoot(root, rel)
  if (!dir) return []
  const entries = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter((e) => !HIDDEN.has(e.name))
  const ignored = await ignoredNames(
    dir,
    entries.map((e) => e.name)
  )
  return entries
    .map((e) => ({
      name: e.name,
      path: rel ? `${rel}/${e.name}` : e.name,
      isDir: e.isDirectory(),
      ignored: ignored.has(e.name)
    }))
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}
