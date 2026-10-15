import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { homeUnc, parseWslPath } from '../wsl'
import { allWorktrees } from './store'

// ~/.argus/worktrees: fora do projeto, para os vigias de arquivo da pasta principal (dev server,
// TypeScript, busca) não enxergarem uma segunda cópia inteira do monorepo. Repositório no WSL: a
// pasta fica no Linux também, senão o git e o pnpm atravessariam a fronteira a cada arquivo.
function worktreesRoot(repoRoot: string): string {
  const wsl = parseWslPath(repoRoot)
  const home = (wsl && homeUnc(wsl.distro, wsl.linux)) || homedir()
  return join(home, '.argus', 'worktrees')
}

// ~/.argus/worktrees/<repo>/tarefa-<data e hora>. Nunca reaproveita o nome de uma tarefa removida:
// as conversas do Claude Code ficam guardadas pela pasta, e a tarefa nova abriria com o histórico da
// antiga. O nome da tarefa ainda não existe quando a pasta é reservada; ele fica na branch, que o
// agente nomeia.
export function worktreeFolder(repoRoot: string): string {
  const parent = join(worktreesRoot(repoRoot), basename(repoRoot))
  const reserved = new Set(allWorktrees().map((w) => w.path))
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  for (let n = 1; ; n++) {
    const dir = join(parent, `tarefa-${stamp}${n === 1 ? '' : `-${n}`}`)
    if (!existsSync(dir) && !reserved.has(dir)) return dir
  }
}
