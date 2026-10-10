import { MAIN_ACCOUNT } from '../../shared/auth'
import { errorMessage } from '../lib/errors'
import { quarantine, readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { ID, registryFile } from './paths'

// A lista de contas do app (accounts.json, na pasta de dados): quais existem além da principal, os
// apelidos e a padrão.

type Registry = {
  // Só as que não são a principal, na ordem em que entraram.
  accounts: string[]
  // Apelidos escolhidos, inclusive o da principal.
  names: Record<string, string>
  defaultId: string
}

let registry: Registry | null = null
// O accounts.json foi lido (ou ainda não existia)? Ilegível, ele não diz quais contas existem: nada
// de apagar pasta de conta nesta abertura (ver erase.ts).
let readable = true
// Contas novas esperando o login terminar: já têm pasta, mas ainda não entram na lista.
export const pending = new Set<string>()

const empty = (): Registry => ({ accounts: [], names: {}, defaultId: MAIN_ACCOUNT })

// Só o formato esperado: ids de 8 caracteres e apelidos em texto. O resto é ignorado.
function validate(saved: unknown): Registry {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof Registry, unknown>>
  const accounts = Array.isArray(s.accounts)
    ? [...new Set(s.accounts.filter((id): id is string => typeof id === 'string' && ID.test(id)))]
    : []
  const names =
    s.names && typeof s.names === 'object'
      ? Object.fromEntries(Object.entries(s.names).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {}
  return { accounts, names, defaultId: typeof s.defaultId === 'string' ? s.defaultId : MAIN_ACCOUNT }
}

export function reg(): Registry {
  if (registry) return registry
  const file = registryFile()
  const read = readJsonFile(file)
  if (read.status === 'ok') registry = validate(read.data)
  else {
    if (read.status === 'corrupt') {
      readable = false
      // O arquivo ilegível vai para o lado, com a data, para as contas darem para ser recuperadas à
      // mão. A lista começa vazia e a próxima gravação cria um novo.
      console.error('[accounts] accounts.json ilegível:', read.error, '- guardado em', quarantine(file))
    }
    registry = empty()
  }
  return registry
}

// false quando o accounts.json desta abertura não pôde ser lido.
export function registryReadable(): boolean {
  reg()
  return readable
}

function save(): void {
  try {
    writeJsonAtomicSync(registryFile(), reg())
  } catch (err) {
    // Sem gravar, vale só até fechar o app.
    console.error('[accounts] não deu para gravar o accounts.json:', errorMessage(err))
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

// A conta pedida, se ela existe (ou está entrando agora); senão, a padrão. Grupo com conta que
// foi removida cai aqui.
export function resolveAccount(id?: string): string {
  if (id && (id === MAIN_ACCOUNT || reg().accounts.includes(id) || pending.has(id))) return id
  return defaultAccount()
}

export function customName(id: string): string | undefined {
  return reg().names[id]
}

export function addAccount(id: string): void {
  pending.delete(id)
  const r = reg()
  if (!r.accounts.includes(id)) r.accounts.push(id)
  save()
}

// Tira a conta da lista (a pasta é com quem chamou). Grupos que usavam ela passam a usar a padrão.
export function forgetAccount(id: string): void {
  const r = reg()
  r.accounts = r.accounts.filter((a) => a !== id)
  delete r.names[id]
  if (r.defaultId === id) r.defaultId = MAIN_ACCOUNT
  save()
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
