import { homedir } from 'node:os'
import { join } from 'node:path'
import { errorMessage } from '../lib/errors'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'

// Copiados da principal uma vez, ao criar a conta: o terminal dela não repete a apresentação nem
// pergunta de novo se confia em cada pasta, e os MCPs começam iguais (os que pedem login pedem
// de novo, nesta conta). As migrações já feitas vão junto: refeitas aqui, mexeriam nas
// configurações, que são as mesmas da principal.
const SEED_KEYS = new Set([
  'hasCompletedOnboarding',
  'lastOnboardingVersion',
  'installMethod',
  'autoUpdates',
  'autoUpdatesProtectedForNative',
  'mcpServers'
])
const SEED_MIGRATIONS = /migration|^unpin/i
const SEED_PROJECT_KEYS = [
  'hasTrustDialogAccepted',
  'allowedTools',
  'mcpServers',
  'mcpContextUris',
  'enabledMcpjsonServers',
  'disabledMcpjsonServers',
  'disabledMcpServers',
  'hasClaudeMdExternalIncludesApproved',
  'hasClaudeMdExternalIncludesWarningShown'
]

function pick(from: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((k) => k in from).map((k) => [k, from[k]]))
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

// O .claude.json da conta nova, a partir do da principal. Sem ele (ou ilegível), a conta começa
// do zero, como um Claude Code recém-instalado.
export function seed(dir: string): void {
  const read = readJsonFile(join(homedir(), '.claude.json'))
  if (read.status !== 'ok' || !isObject(read.data)) return
  const main = read.data
  const config = Object.fromEntries(Object.entries(main).filter(([k]) => SEED_KEYS.has(k) || SEED_MIGRATIONS.test(k)))
  if (isObject(main.projects)) {
    config.projects = Object.fromEntries(
      Object.entries(main.projects).map(([path, p]) => [path, pick(isObject(p) ? p : {}, SEED_PROJECT_KEYS)])
    )
  }
  try {
    writeJsonAtomicSync(join(dir, '.claude.json'), config, { indent: 2, mode: 0o600 })
  } catch (err) {
    console.warn('[accounts] não deu para copiar as configurações da principal:', errorMessage(err))
  }
}
