import { describe, expect, it } from 'vitest'
import { worktreeMove } from './worktreeMove'

// O Claude entra num worktree e o Claude Code muda o arquivo da conversa de pasta: sem perceber
// isso, a conversa sumia da tela no meio do pedido (bug de 2026-10-23). Os resultados são os que o
// SDK 0.3.308 manda junto do resultado de cada ferramenta.

const repo = '/Users/ana/repo'

describe('worktreeMove', () => {
  it('lê a entrada num worktree criado pelo Claude', () => {
    const result = {
      worktreePath: '/Users/ana/repo/.claude/worktrees/teste-a',
      worktreeBranch: 'worktree-teste-a',
      message: 'Created worktree at “/Users/ana/repo/.claude/worktrees/teste-a”…'
    }
    expect(worktreeMove(result, repo)).toEqual({ path: '/Users/ana/repo/.claude/worktrees/teste-a', from: repo, branch: 'worktree-teste-a' })
  })

  it('lê a entrada num worktree que já existia', () => {
    const result = { worktreePath: '/Users/ana/repo-ui', worktreeBranch: 'feat/ui', message: 'Entered worktree at “/Users/ana/repo-ui” on branch “feat/ui”.' }
    expect(worktreeMove(result, repo)).toEqual({ path: '/Users/ana/repo-ui', from: repo, branch: 'feat/ui' })
  })

  it('lê a saída, mantendo ou apagando a pasta, com a pasta de volta', () => {
    const result = {
      action: 'remove',
      originalCwd: repo,
      worktreePath: '/Users/ana/repo/.claude/worktrees/teste-a',
      worktreeBranch: 'worktree-teste-a',
      discardedFiles: 0,
      message: 'Exited and removed worktree…'
    }
    expect(worktreeMove(result, '/Users/ana/repo/.claude/worktrees/teste-a')).toEqual({
      path: '/Users/ana/repo/.claude/worktrees/teste-a',
      from: repo,
      branch: 'worktree-teste-a',
      left: 'remove'
    })
  })

  it('no WSL, os caminhos do Linux viram os que o Windows enxerga', () => {
    const cwd = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\repo'
    const result = { worktreePath: '/home/ana/repo-ui', worktreeBranch: 'feat/ui', message: 'Entered worktree…' }
    expect(worktreeMove(result, cwd)).toEqual({ path: '\\\\wsl.localhost\\Ubuntu\\home\\ana\\repo-ui', from: cwd, branch: 'feat/ui' })
  })

  it('ignora o resultado de outras ferramentas, mesmo com worktreePath', () => {
    expect(worktreeMove({ matches: ['EnterWorktree'], query: 'select:EnterWorktree' }, repo)).toBeNull()
    expect(worktreeMove({ status: 'completed', content: [], worktreePath: '/Users/ana/repo-x', message: 'ok' }, repo)).toBeNull()
    expect(worktreeMove('texto', repo)).toBeNull()
    expect(worktreeMove(undefined, repo)).toBeNull()
  })
})
