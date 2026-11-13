import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { currentBranch, findRepo } from './repo'

// O repositório e a branch de cada pasta do canvas, lidos a cada poucos segundos. Desde
// 2026-10-23 sem travar o app: no WSL cada leitura atravessa a rede até o Linux.

const home = () => process.env.HOME ?? ''

function repo(head = 'ref: refs/heads/feat/checkout\n'): string {
  const root = mkdtempSync(join(home(), 'repo-'))
  mkdirSync(join(root, '.git'))
  writeFileSync(join(root, '.git', 'HEAD'), head)
  return root
}

describe('findRepo e currentBranch', () => {
  it('acha o repositório subindo de uma pasta de dentro, e a branch pelo HEAD', async () => {
    const root = repo()
    mkdirSync(join(root, 'apps', 'web'), { recursive: true })
    expect(await findRepo(join(root, 'apps', 'web'))).toEqual({ root, gitDir: join(root, '.git') })
    expect(await currentBranch(join(root, 'apps', 'web'))).toBe('feat/checkout')
  })

  it('worktree: o .git é um arquivo que aponta para a pasta dele', async () => {
    const main = repo()
    const gitDir = join(main, '.git', 'worktrees', 'tarefa')
    mkdirSync(gitDir, { recursive: true })
    writeFileSync(join(gitDir, 'HEAD'), 'ref: refs/heads/wip/tarefa\n')
    const tree = mkdtempSync(join(home(), 'tarefa-'))
    writeFileSync(join(tree, '.git'), `gitdir: ${gitDir}\n`)
    expect(await findRepo(tree)).toEqual({ root: tree, gitDir })
    expect(await currentBranch(tree)).toBe('wip/tarefa')
  })

  it('HEAD solto vira o hash curto; fora de repositório, nulo', async () => {
    expect(await currentBranch(repo('0123456789abcdef0123456789abcdef01234567\n'))).toBe('0123456')
    expect(await currentBranch(mkdtempSync(join(home(), 'solta-')))).toBeNull()
  })

  it('não passa da pasta do usuário, mas a própria pasta do usuário vale', async () => {
    mkdirSync(join(home(), '.git'), { recursive: true })
    writeFileSync(join(home(), '.git', 'HEAD'), 'ref: refs/heads/dotfiles\n')
    try {
      expect(await findRepo(mkdtempSync(join(home(), 'sem-git-')))).toBeNull()
      expect((await findRepo(home()))?.root).toBe(home())
    } finally {
      rmSync(join(home(), '.git'), { recursive: true, force: true })
    }
  })
})
