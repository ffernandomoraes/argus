import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'

const HOME = resolve(homedir())
const sameDir = (a: string, b: string) => (IS_WIN ? a.toLowerCase() === b.toLowerCase() : a === b)

export type Repo = { root: string; gitDir: string }

// Checkout que contém a pasta: sobe até achar o `.git`. `root` é a raiz dos arquivos;
// `gitDir`, onde o git guarda o HEAD. Em worktree, o `.git` é um arquivo que aponta
// para a pasta dele ("gitdir: ..."). Não passa da pasta do usuário: com os dotfiles versionados
// em ~/.git, toda pasta sem git cairia no repositório da home, e o status varreria a home
// inteira. A própria home, aberta como projeto, ainda vale.
export function findRepo(folder: string): Repo | null {
  const start = resolve(expandHome(folder))
  let dir = start
  while (true) {
    if (sameDir(dir, HOME) && !sameDir(start, HOME)) return null
    const dotGit = join(dir, '.git')
    try {
      if (statSync(dotGit).isDirectory()) return { root: dir, gitDir: dotGit }
      const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1].trim()
      if (pointer) return { root: dir, gitDir: resolve(dir, pointer) }
    } catch {
      // Sem `.git` aqui: tenta a pasta de cima.
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function gitDir(folder: string): string | null {
  return findRepo(folder)?.gitDir ?? null
}

// Branch atual lida direto do HEAD, sem rodar o git. HEAD solto (um commit, sem branch)
// vira o hash curto. Pasta fora de repositório: nulo.
export function currentBranch(folder: string): string | null {
  const dir = gitDir(folder)
  if (!dir) return null
  try {
    const head = readFileSync(join(dir, 'HEAD'), 'utf8').trim()
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1]
    return ref ?? (/^[0-9a-f]{40}/.test(head) ? head.slice(0, 7) : null)
  } catch {
    return null
  }
}
