import { access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readPackageJson } from './packageJson'

// Scripts do package.json, na ordem de preferência.
const SCRIPTS = ['dev', 'start']
const MANAGERS = /^(pnpm|yarn|npm|bun)$/
const LOCKFILES: [string, string][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm']
]

// A trava achada vale por um minuto: a consulta dos servidores pergunta a cada poucos segundos, e
// cada procura confere cinco arquivos por pasta até a raiz. No WSL, cada conferência atravessa a
// rede até o Linux, e a síncrona travava o app inteiro enquanto ele não respondia (2026-10-23).
const LOCK_TTL = 60_000
const found = new Map<string, { manager: string; at: number }>()

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  )

// Em monorepo, a trava do gerenciador fica numa pasta acima do pacote.
export async function packageManager(root: string, declared: unknown): Promise<string> {
  const name = typeof declared === 'string' ? declared.split('@')[0] : ''
  if (MANAGERS.test(name)) return name
  const hit = found.get(root)
  if (hit && Date.now() - hit.at < LOCK_TTL) return hit.manager
  const manager = await lockManager(root)
  found.set(root, { manager, at: Date.now() })
  return manager
}

async function lockManager(root: string): Promise<string> {
  for (let dir = root; ; dir = dirname(dir)) {
    const here = await Promise.all(LOCKFILES.map(([file]) => exists(join(dir, file))))
    const i = here.indexOf(true)
    if (i >= 0) return LOCKFILES[i][1]
    if (dirname(dir) === dir) return 'npm'
  }
}

// body: o texto do script no package.json (ver freePort.ts); manager: o gerenciador que roda.
export type ProjectScript = { script: string; command: string; body: string; manager: string }

// O script que o play roda na pasta (dev; sem ele, start), com o gerenciador do projeto.
export async function projectScript(root: string): Promise<ProjectScript | null> {
  const pkg = await readPackageJson(root)
  if (!pkg) return null
  const script = SCRIPTS.find((s) => typeof pkg.scripts?.[s] === 'string')
  if (!script) return null
  const manager = await packageManager(root, pkg.packageManager)
  return { script, command: `${manager} run ${script}`, body: String(pkg.scripts?.[script]), manager }
}
