import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { MAIN_DIR } from '../accounts/paths'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'

// Depois de quantos dias sem atividade o Claude Code apaga a conversa inteira (texto, prints e
// anexos): o cleanupPeriodDays do settings.json do usuário, que ele aplica sozinho ao abrir. O Argus
// lê e grava esse mesmo valor (aba Armazenamento), então vale também para o `claude` no terminal; as
// contas do Argus usam o arquivo da principal (ver accounts/links.ts). Sem o valor, o Claude Code usa
// 30 dias; o Argus põe o padrão dele (ver ensureConversationDays).

// Pelo caminho real: settings.json ligado a outro lugar (dotfiles) continua ligado depois de gravar.
function file(): string {
  const path = join(MAIN_DIR, 'settings.json')
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

type Read = { status: 'ok'; settings: Record<string, unknown> } | { status: 'corrupt' }

function read(path: string): Read {
  const r = readJsonFile<Record<string, unknown>>(path)
  if (r.status === 'corrupt') return { status: 'corrupt' }
  const settings = r.status === 'ok' && r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {}
  return { status: 'ok', settings }
}

// O prazo em vigor; nulo sem ele no arquivo (ou com o arquivo estragado).
export function conversationDays(path = file()): number | null {
  const r = read(path)
  const days = r.status === 'ok' ? r.settings.cleanupPeriodDays : undefined
  return typeof days === 'number' && days > 0 ? days : null
}

// Grava o prazo, mantendo o resto das configurações. Arquivo estragado não é gravado por cima
// (perderia as configurações da pessoa). Nunca 0: para o Claude Code, 0 é não guardar conversa.
export function setConversationDays(days: number, path = file()): boolean {
  const r = read(path)
  if (r.status === 'corrupt' || !Number.isInteger(days) || days <= 0) return false
  if (r.settings.cleanupPeriodDays === days) return true
  try {
    writeJsonAtomicSync(path, { ...r.settings, cleanupPeriodDays: days }, { indent: 2 })
    return true
  } catch (err) {
    console.warn('[armazenamento] não deu para gravar o prazo das conversas:', err)
    return false
  }
}

// Na abertura, antes do primeiro `claude`: sem prazo escolhido, vale o padrão do Argus em vez dos
// 30 dias do Claude Code. Um prazo que já esteja no arquivo fica como está.
export function ensureConversationDays(fallback: number, path = file()): void {
  if (read(path).status === 'ok' && conversationDays(path) === null) setConversationDays(fallback, path)
}
