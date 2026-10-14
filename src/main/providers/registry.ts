import { MAIN_PROVIDER_ACCOUNT, PROVIDERS, type AccountKind, type ProviderId } from '../../shared/providers'
import { errorMessage } from '../lib/errors'
import { quarantine, readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { ID, registryFile } from './paths'

// A lista de contas dos agentes (agent-accounts.json, na pasta de dados): quais existem, de que
// tipo, os apelidos e a padrão de cada agente. A principal (a do terminal) entra na lista quando é
// usada pela primeira vez, como qualquer outra.

type Entry = { id: string; provider: ProviderId; kind: AccountKind }

type Registry = {
  accounts: Entry[]
  // Apelidos, por "<agente>/<id>".
  names: Record<string, string>
  defaults: Partial<Record<ProviderId, string>>
}

let registry: Registry | null = null
// Contas novas esperando o login (ou a chave) terminar: já têm pasta, ainda fora da lista.
export const pending = new Map<string, Entry>()

const key = (provider: ProviderId, id: string) => `${provider}/${id}`

function validate(saved: unknown): Registry {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof Registry, unknown>>
  const seen = new Set<string>()
  const accounts = (Array.isArray(s.accounts) ? s.accounts : []).filter((e): e is Entry => {
    if (!e || typeof e !== 'object') return false
    const { id, provider, kind } = e as Entry
    const ok =
      PROVIDERS.includes(provider) &&
      (kind === 'login' || kind === 'key') &&
      (id === MAIN_PROVIDER_ACCOUNT || (typeof id === 'string' && ID.test(id))) &&
      !seen.has(key(provider, id))
    if (ok) seen.add(key(provider, id))
    return ok
  })
  const names =
    s.names && typeof s.names === 'object'
      ? Object.fromEntries(Object.entries(s.names).filter((e): e is [string, string] => typeof e[1] === 'string'))
      : {}
  const defaults =
    s.defaults && typeof s.defaults === 'object'
      ? Object.fromEntries(
          Object.entries(s.defaults).filter((e): e is [ProviderId, string] => PROVIDERS.includes(e[0] as ProviderId) && typeof e[1] === 'string')
        )
      : {}
  return { accounts, names, defaults }
}

function reg(): Registry {
  if (registry) return registry
  const file = registryFile()
  const read = readJsonFile(file)
  if (read.status === 'ok') registry = validate(read.data)
  else {
    if (read.status === 'corrupt') console.error('[providers] agent-accounts.json ilegível:', read.error, '- guardado em', quarantine(file))
    registry = { accounts: [], names: {}, defaults: {} }
  }
  return registry
}

function save(): void {
  try {
    writeJsonAtomicSync(registryFile(), reg())
  } catch (err) {
    console.error('[providers] não deu para gravar o agent-accounts.json:', errorMessage(err))
  }
}

export function entries(provider: ProviderId): Entry[] {
  return reg().accounts.filter((a) => a.provider === provider)
}

export function findEntry(provider: ProviderId, id: string): Entry | undefined {
  return reg().accounts.find((a) => a.provider === provider && a.id === id) ?? pending.get(key(provider, id))
}

export function addEntry(entry: Entry): void {
  pending.delete(key(entry.provider, entry.id))
  const r = reg()
  if (!r.accounts.some((a) => a.provider === entry.provider && a.id === entry.id)) r.accounts.push(entry)
  // A primeira conta do agente vira a padrão dele.
  if (!r.defaults[entry.provider]) r.defaults[entry.provider] = entry.id
  save()
}

export function addPending(entry: Entry): void {
  pending.set(key(entry.provider, entry.id), entry)
}

export function dropPending(provider: ProviderId, id: string): void {
  pending.delete(key(provider, id))
}

export function forgetEntry(provider: ProviderId, id: string): void {
  const r = reg()
  r.accounts = r.accounts.filter((a) => !(a.provider === provider && a.id === id))
  delete r.names[key(provider, id)]
  if (r.defaults[provider] === id) {
    const next = r.accounts.find((a) => a.provider === provider)
    if (next) r.defaults[provider] = next.id
    else delete r.defaults[provider]
  }
  save()
}

export function customName(provider: ProviderId, id: string): string | undefined {
  return reg().names[key(provider, id)]
}

export function renameEntry(provider: ProviderId, id: string, name: string): void {
  const r = reg()
  const clean = name.trim().slice(0, 40)
  if (clean) r.names[key(provider, id)] = clean
  else delete r.names[key(provider, id)]
  save()
}

export function defaultEntry(provider: ProviderId): string | null {
  const r = reg()
  const list = entries(provider)
  const id = r.defaults[provider]
  return list.some((a) => a.id === id) ? id! : (list[0]?.id ?? null)
}

export function setDefaultEntry(provider: ProviderId, id: string): void {
  if (!entries(provider).some((a) => a.id === id)) return
  reg().defaults[provider] = id
  save()
}

// A conta pedida, se existe; senão, a padrão do agente. Nulo: o agente não tem conta.
export function resolveEntry(provider: ProviderId, id?: string): Entry | null {
  const wanted = id ? findEntry(provider, id) : undefined
  if (wanted) return wanted
  const fallback = defaultEntry(provider)
  return fallback ? (findEntry(provider, fallback) ?? null) : null
}
