import { existsSync } from 'node:fs'
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

// Em monorepo, a trava do gerenciador fica numa pasta acima do pacote.
function packageManager(root: string, declared: unknown): string {
  const name = typeof declared === 'string' ? declared.split('@')[0] : ''
  if (MANAGERS.test(name)) return name
  for (let dir = root; ; dir = dirname(dir)) {
    const hit = LOCKFILES.find(([file]) => existsSync(join(dir, file)))
    if (hit) return hit[1]
    if (dirname(dir) === dir) return 'npm'
  }
}

export type ProjectScript = { script: string; command: string }

// O script que o play roda na pasta (dev; sem ele, start), com o gerenciador do projeto.
export async function projectScript(root: string): Promise<ProjectScript | null> {
  const pkg = await readPackageJson(root)
  if (!pkg) return null
  const script = SCRIPTS.find((s) => typeof pkg.scripts?.[s] === 'string')
  if (!script) return null
  return { script, command: `${packageManager(root, pkg.packageManager)} run ${script}` }
}
