import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { MAIN_ACCOUNT, type Account } from '../shared/auth'

// Contas do Claude no app. A principal é a do ~/.claude, a mesma do terminal e do VS Code. Cada
// outra mora numa pasta própria, passada ao `claude` em CLAUDE_CONFIG_DIR (a pasta de configuração
// do Claude Code): o .claude.json dela fica lá dentro, e o login vai para outro item das Chaves do
// macOS, "Claude Code-credentials-" mais o hash da pasta (conferido na 2.1.291). Assim as contas
// rodam ao mesmo tempo sem uma derrubar a outra.
// O que é seu fica ligado à principal por link simbólico; o login e os MCPs, não.

const MAIN_DIR = join(homedir(), '.claude')
// Mesma separação do comando argus: o pnpm dev tem as contas dele.
const ROOT = join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'accounts')
const ID = /^[a-f0-9]{8}$/
// Lido só na hora de usar: o pnpm dev troca a pasta de dados depois de importar os módulos.
const registryFile = () => join(app.getPath('userData'), 'accounts.json')

// Ligados à principal: o histórico das conversas (com a memória automática, que mora nele), as
// instruções, agentes, skills, comandos, plugins e configurações. O Claude Code grava as
// configurações do usuário através do link; só recusa link nas de projeto, que ficam na pasta do
// projeto e não passam por aqui. O .claude.json nunca é ligado: ele guarda a organização da
// conta, que o Claude Code usa nos pedidos, e misturaria uma conta com a outra.
const SHARED = [
  'projects',
  'CLAUDE.md',
  'settings.json',
  'keybindings.json',
  'agents',
  'skills',
  'commands',
  'plugins',
  'output-styles'
]

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

type Registry = {
  // Só as que não são a principal, na ordem em que entraram.
  accounts: string[]
  // Apelidos escolhidos, inclusive o da principal.
  names: Record<string, string>
  defaultId: string
}

let registry: Registry | null = null
// Contas novas esperando o login terminar: já têm pasta, mas ainda não entram na lista.
const pending = new Set<string>()

function reg(): Registry {
  if (registry) return registry
  try {
    const saved = JSON.parse(readFileSync(registryFile(), 'utf8')) as Partial<Registry>
    const accounts = Array.isArray(saved.accounts) ? saved.accounts.filter((id) => ID.test(id)) : []
    const names = saved.names && typeof saved.names === 'object' ? saved.names : {}
    registry = { accounts, names, defaultId: typeof saved.defaultId === 'string' ? saved.defaultId : MAIN_ACCOUNT }
  } catch {
    registry = { accounts: [], names: {}, defaultId: MAIN_ACCOUNT }
  }
  return registry
}

function save(): void {
  try {
    writeFileSync(registryFile(), JSON.stringify(reg()))
  } catch {
    // Sem gravar, vale só até fechar o app.
  }
}

// A principal primeiro, depois as outras na ordem em que entraram.
export function accountIds(): string[] {
  return [MAIN_ACCOUNT, ...reg().accounts]
}

export function defaultAccount(): string {
  const { accounts, defaultId } = reg()
  return accounts.includes(defaultId) ? defaultId : MAIN_ACCOUNT
}

// Pasta da conta. A principal não tem: o `claude` sem a variável usa ~/.claude.
export function accountDir(id: string): string | undefined {
  return id === MAIN_ACCOUNT ? undefined : join(ROOT, id)
}

// A conta pedida, se ela existe (ou está entrando agora); senão, a padrão. Grupo com conta que
// foi removida cai aqui.
export function resolveAccount(id?: string): string {
  if (id && (id === MAIN_ACCOUNT || reg().accounts.includes(id) || pending.has(id))) return id
  return defaultAccount()
}

export function customName(id: string): string | undefined {
  return reg().names[id]
}

// Nome sugerido: o da organização, quando é empresa. Plano individual vira "Pessoal"; o Claude
// chama a organização dele de "<alguém>'s Organization".
export function suggestedName(id: string, status: Account | null, taken: Set<string>): string {
  const org = status?.organization
  const individual = ['free', 'pro', 'max'].includes(status?.subscriptionType ?? '') || /'s organi[sz]ation$/i.test(org ?? '')
  if (org && !individual) return org
  if (status?.email) return taken.has('Pessoal') ? status.email.split('@')[0] : 'Pessoal'
  return id === MAIN_ACCOUNT ? 'Principal' : 'Conta'
}

// Pastas onde cada Claude Code aberto grava o status (<pasta>/sessions/<pid>.json), de todas as contas.
export function statusDirs(): string[] {
  return accountIds().map((id) => join(accountDir(id) ?? MAIN_DIR, 'sessions'))
}

// Põe a conta no ambiente do `claude` e devolve a que ficou valendo. A principal vai sem a
// variável, mesmo se o app foi aberto com ela: o resto do app lê ~/.claude.
export function applyAccount(env: Record<string, string>, id?: string): string {
  const account = resolveAccount(id)
  delete env.CLAUDE_CONFIG_DIR
  delete env.CLAUDE_SECURESTORAGE_CONFIG_DIR
  const dir = accountDir(account)
  if (dir) {
    link(dir)
    env.CLAUDE_CONFIG_DIR = dir
  }
  return account
}

// Também enxerga link quebrado, que o existsSync não vê.
function exists(path: string): boolean {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

// Cria os links que faltam. Roda antes de cada `claude` da conta, então o que surgir depois na
// principal (uma pasta de comandos nova, por exemplo) passa a valer aqui também. O que o Claude
// Code já tiver criado como item de verdade fica como está, para nada se perder.
function link(dir: string): void {
  mkdirSync(join(dir, 'sessions'), { recursive: true })
  mkdirSync(join(MAIN_DIR, 'projects'), { recursive: true })
  for (const name of SHARED) {
    const target = join(MAIN_DIR, name)
    const path = join(dir, name)
    if (!existsSync(target) || exists(path)) continue
    try {
      symlinkSync(target, path)
    } catch {
      // o próprio `claude` criou o item no mesmo instante
    }
  }
}

function pick(from: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((k) => k in from).map((k) => [k, from[k]]))
}

function seed(dir: string): void {
  let main: Record<string, unknown>
  try {
    main = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
  } catch {
    return
  }
  const config = Object.fromEntries(Object.entries(main).filter(([k]) => SEED_KEYS.has(k) || SEED_MIGRATIONS.test(k)))
  if (main.projects && typeof main.projects === 'object') {
    config.projects = Object.fromEntries(
      Object.entries(main.projects as Record<string, Record<string, unknown>>).map(([path, p]) => [
        path,
        pick(p ?? {}, SEED_PROJECT_KEYS)
      ])
    )
  }
  writeFileSync(join(dir, '.claude.json'), JSON.stringify(config, null, 2), { mode: 0o600 })
}

// Pasta de uma conta nova, pronta para o login. Ela só entra na lista com addAccount.
export function createPendingAccount(): string {
  const id = randomUUID().replace(/-/g, '').slice(0, 8)
  const dir = join(ROOT, id)
  mkdirSync(dir, { recursive: true })
  seed(dir)
  link(dir)
  pending.add(id)
  return id
}

export function addAccount(id: string): void {
  pending.delete(id)
  const r = reg()
  if (!r.accounts.includes(id)) r.accounts.push(id)
  save()
}

// Login de conta nova cancelado ou recusado: some a pasta e o login que ela tenha guardado.
export function discardAccount(id: string): void {
  pending.delete(id)
  erase(id)
}

// Tira a conta da lista e apaga a pasta. Grupos que usavam ela passam a usar a padrão.
export function removeAccount(id: string): void {
  if (id === MAIN_ACCOUNT) return
  const r = reg()
  r.accounts = r.accounts.filter((a) => a !== id)
  delete r.names[id]
  if (r.defaultId === id) r.defaultId = MAIN_ACCOUNT
  save()
  erase(id)
}

// Vazio volta para o nome sugerido.
export function renameAccount(id: string, name: string): void {
  const r = reg()
  const clean = name.trim().slice(0, 40)
  if (clean) r.names[id] = clean
  else delete r.names[id]
  save()
}

export function setDefaultAccount(id: string): void {
  const r = reg()
  if (id !== MAIN_ACCOUNT && !r.accounts.includes(id)) return
  r.defaultId = id
  save()
}

// Mesmo nome que o Claude Code dá ao item das Chaves de uma pasta de configuração.
function keychainService(dir: string): string {
  return `Claude Code-credentials-${createHash('sha256').update(dir.normalize('NFC')).digest('hex').slice(0, 8)}`
}

function erase(id: string): void {
  const dir = accountDir(id)
  if (!dir || !ID.test(id)) return
  // O login fica nas Chaves, fora da pasta. Cobre o caso de o `claude auth logout` ter falhado
  // ou nem ter rodado.
  execFile('security', ['delete-generic-password', '-s', keychainService(dir)], () => {})
  // Os links saem um a um antes: apagar a pasta nunca pode alcançar o que é da principal.
  for (const name of SHARED) {
    const path = join(dir, name)
    try {
      if (lstatSync(path).isSymbolicLink()) unlinkSync(path)
    } catch {
      // não existe
    }
  }
  rmSync(dir, { recursive: true, force: true })
}

// Pastas que sobraram de um login de conta nova interrompido (o app fechou no meio, por exemplo).
export function cleanupAccounts(): void {
  let names: string[]
  try {
    names = readdirSync(ROOT)
  } catch {
    return
  }
  const known = new Set(reg().accounts)
  for (const id of names) if (ID.test(id) && !known.has(id) && !pending.has(id)) erase(id)
}
