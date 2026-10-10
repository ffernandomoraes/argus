import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { loginShellPath } from '../platform'

// App aberto pelo Finder não herda o PATH do terminal; procura nos lugares comuns. Primeiro o
// instalador oficial e o Homebrew; depois os gerenciadores de Node (o `claude` instalado pelo npm
// fica na pasta de cada um). Um a um: para no primeiro que existir.
function* candidates(): Generator<string> {
  const home = homedir()
  yield join(home, '.local/bin/claude')
  yield join(home, '.claude/local/claude')
  yield '/opt/homebrew/bin/claude'
  yield '/usr/local/bin/claude'
  yield* nvmCandidates(home)
  yield join(home, '.volta/bin/claude')
  yield join(home, '.bun/bin/claude')
  yield join(home, '.npm-global/bin/claude')
}

// "v22.11.0" vira [22, 11, 0]; o que não for versão fica no fim da ordem.
function versionKey(name: string): number[] {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(name)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [-1, -1, -1]
}

function newerFirst(a: string, b: string): number {
  const [x, y] = [versionKey(a), versionKey(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}

// nvm: um Node por versão, cada um com os pacotes globais dele. Vale o da versão mais nova.
function nvmCandidates(home: string): string[] {
  const root = join(home, '.nvm/versions/node')
  let versions: string[]
  try {
    versions = readdirSync(root)
  } catch {
    return []
  }
  return versions.sort(newerFirst).map((v) => join(root, v, 'bin/claude'))
}

export function knownClaude(): string | null {
  for (const path of candidates()) if (existsSync(path)) return path
  return null
}

// Reserva: o PATH do shell de login da pessoa (loginShellPath, de platform.ts), para instalações
// fora dos lugares conhecidos. Roda em segundo plano (lookupLoginShell) e fica guardado; sem
// achar, pode tentar de novo depois de um tempo, para um `claude` instalado com o app aberto.
// Pelo PATH, e não por `command -v claude`: um alias de mesmo nome no .zshrc esconderia o programa.
const RETRY_MS = 5 * 60_000
let shellClaude: string | null = null
let checkedAt = 0
let running: Promise<void> | null = null

export function loginShellClaude(): string | null {
  return shellClaude && existsSync(shellClaude) ? shellClaude : null
}

export function lookupLoginShell(): Promise<void> {
  if (loginShellClaude() || (checkedAt && Date.now() - checkedAt < RETRY_MS)) return Promise.resolve()
  running ??= loginShellPath()
    .then((dirs) => {
      shellClaude =
        dirs
          .filter((d) => isAbsolute(d))
          .map((d) => join(d, 'claude'))
          .find((p) => existsSync(p)) ?? null
      checkedAt = Date.now()
    })
    .finally(() => {
      running = null
    })
  return running
}
