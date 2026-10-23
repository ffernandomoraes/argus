import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'
import { homeUnc, parseWslPath } from '../wsl'

const HOME = resolve(homedir())
const sameDir = (a: string, b: string) => (IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b)

export type Repo = { root: string; gitDir: string }

// Checkout que contém a pasta: sobe até achar o `.git`. `root` é a raiz dos arquivos;
// `gitDir`, onde o git guarda o HEAD. Em worktree, o `.git` é um arquivo que aponta
// para a pasta dele ("gitdir: ..."). Não passa da pasta do usuário: com os dotfiles versionados
// em ~/.git, toda pasta sem git cairia no repositório da home, e o status varreria a home
// inteira. A própria home, aberta como projeto, ainda vale. Leitura assíncrona: a branch de cada
// pasta é lida a cada poucos segundos, e no WSL cada passo atravessa a rede até o Linux; a síncrona
// travava o app inteiro enquanto ele não respondia (2026-10-23).
export async function findRepo(folder: string): Promise<Repo | null> {
  const start = resolve(expandHome(folder))
  // Pasta do WSL: o limite é a pasta do usuário no Linux.
  const wsl = parseWslPath(start)
  const home = (wsl && homeUnc(wsl.distro, wsl.linux)) || HOME
  for (let dir = start; ; dir = dirname(dir)) {
    if (sameDir(dir, home) && !sameDir(start, home)) return null
    const repo = await repoAt(dir)
    if (repo) return repo
    if (dirname(dir) === dir) return null
  }
}

// O `.git` desta pasta, se houver: a pasta dele ou, num worktree, o arquivo que aponta para ela.
async function repoAt(dir: string): Promise<Repo | null> {
  const dotGit = join(dir, '.git')
  try {
    if ((await stat(dotGit)).isDirectory()) return { root: dir, gitDir: dotGit }
    const pointer = /^gitdir:\s*(.+)$/m.exec(await readFile(dotGit, 'utf8'))?.[1].trim()
    return pointer ? { root: dir, gitDir: resolve(dir, pointer) } : null
  } catch {
    // Sem `.git` aqui: quem chama tenta a pasta de cima.
    return null
  }
}

export async function gitDir(folder: string): Promise<string | null> {
  return (await findRepo(folder))?.gitDir ?? null
}

// Branch atual lida direto do HEAD, sem rodar o git. HEAD solto (um commit, sem branch)
// vira o hash curto. Pasta fora de repositório: nulo.
export async function currentBranch(folder: string): Promise<string | null> {
  const dir = await gitDir(folder)
  if (!dir) return null
  try {
    const head = (await readFile(join(dir, 'HEAD'), 'utf8')).trim()
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1]
    return ref ?? (/^[0-9a-f]{40}/.test(head) ? head.slice(0, 7) : null)
  } catch {
    return null
  }
}
