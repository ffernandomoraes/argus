import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { worktreeStatus } from './status'
import { rememberWorktree } from './store'

// O git responde daqui, e cada chamada fica contada: o rev-list diz 2 commits sem enviar, o resto
// volta vazio (sem arquivo alterado, a base existe).
const git = vi.hoisted(() => vi.fn(async (_cwd: string, args: string[]) => (args.includes('rev-list') ? '2\n' : '')))
vi.mock('../gitBranch/git', async (importOriginal) => ({ ...(await importOriginal<typeof import('../gitBranch/git')>()), git }))

// O git status tem leitura guardada por um instante; os outros comandos são os que se acumulavam.
const counted = () => git.mock.calls.filter(([, args]) => !args.includes('status')).length

function worktree(): string {
  const dir = mkdtempSync(join(process.env.HOME ?? '', 'tarefa-'))
  mkdirSync(join(dir, '.git'))
  writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/wip/checkout\n')
  rememberWorktree({ path: dir, main: dir, base: 'main' })
  return dir
}

describe('worktreeStatus', () => {
  // 2026-10-23: a faixa do card perguntava a cada 2 s sem esperar a resposta; com o WSL lento, as
  // perguntas se acumulavam, cada uma com quatro a seis git rodando lá dentro.
  it('quem pergunta no meio de uma leitura espera a mesma, sem rodar o git de novo', async () => {
    const dir = worktree()
    const one = await worktreeStatus(dir)
    expect(one).toMatchObject({ state: 'ready', branch: 'wip/checkout', files: 0, uncommitted: 0, unpushed: 2 })
    const perRead = counted()
    git.mockClear()
    const all = await Promise.all([worktreeStatus(dir), worktreeStatus(dir), worktreeStatus(dir)])
    expect(counted()).toBe(perRead)
    expect(all).toEqual([one, one, one])
  })

  it('pasta que não é tarefa do Argus: nulo, sem git', async () => {
    git.mockClear()
    expect(await worktreeStatus(join(process.env.HOME ?? '', 'outra'))).toBeNull()
    expect(git).not.toHaveBeenCalled()
  })
})
