import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { app, shell } from 'electron'
import type { Message } from '../../shared/history'
import type { ProviderId } from '../../shared/providers'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { expandHome } from '../paths'

// Conversas com os outros agentes, gravadas pelo próprio Argus no formato do chat (Message), uma
// por arquivo. Cada CLI guarda o histórico num formato próprio, que muda a cada versão (o do Cursor
// é um banco interno); o Argus não depende deles para mostrar a conversa. O id nativo (thread do
// Codex, sessão do ACP) fica junto, para o agente retomar com o contexto dele.
// O índice (index.json) resume todas, para a lista de conversas não abrir arquivo por arquivo.

export type StoredConversation = {
  version: 1
  id: string
  provider: ProviderId
  account: string
  cwd: string
  title: string
  createdAt: string
  updatedAt: string
  nativeId?: string
  contextPercent: number
  design?: boolean
  messages: Message[]
}

// repliedAt: última resposta do agente (ver SessionSummary). Índice antigo não tem: vale o updatedAt.
export type IndexEntry = Pick<StoredConversation, 'provider' | 'account' | 'cwd' | 'title' | 'updatedAt' | 'contextPercent' | 'design'> & {
  repliedAt?: string
}

const root = () => join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'conversations')
const fileOf = (id: string) => join(root(), `${id}.json`)
const imagesOf = (id: string) => join(root(), `${id}.images.json`)
const indexFile = () => join(root(), 'index.json')
const ID = /^[a-f0-9-]{36}$/

let index: Record<string, IndexEntry> | null = null
// Avisa a vigia de sessões que a lista da pasta mudou (ver app/services.ts).
let onSaved: (cwd: string) => void = () => {}
export const onConversationSaved = (cb: (cwd: string) => void) => (onSaved = cb)

function readIndex(): Record<string, IndexEntry> {
  if (index) return index
  const read = readJsonFile<Record<string, IndexEntry>>(indexFile())
  index = read.status === 'ok' && read.data && typeof read.data === 'object' ? read.data : {}
  return index
}

export const samePath = (a: string, b: string) => resolve(expandHome(a)) === resolve(expandHome(b))

export function isAgentConversation(id: string): boolean {
  return ID.test(id) && !!readIndex()[id]
}

export function indexEntry(id: string): IndexEntry | undefined {
  return readIndex()[id]
}

// Conversas de uma pasta, mais recentes primeiro.
export function conversationsIn(cwd: string): (IndexEntry & { id: string })[] {
  return Object.entries(readIndex())
    .filter(([, e]) => samePath(e.cwd, cwd))
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.repliedAt ?? b.updatedAt).localeCompare(a.repliedAt ?? a.updatedAt))
}

export function loadConversation(id: string): StoredConversation | null {
  if (!ID.test(id)) return null
  const read = readJsonFile<StoredConversation>(fileOf(id))
  return read.status === 'ok' && read.data?.version === 1 ? read.data : null
}

export function saveConversation(c: StoredConversation): void {
  try {
    mkdirSync(root(), { recursive: true })
    writeJsonAtomicSync(fileOf(c.id), c)
    const { provider, account, cwd, title, updatedAt, contextPercent, design } = c
    const repliedAt = [...c.messages].reverse().find((m) => m.role === 'assistant' && m.at)?.at ?? c.createdAt
    readIndex()[c.id] = { provider, account, cwd, title, updatedAt, repliedAt, contextPercent, ...(design && { design }) }
    writeJsonAtomicSync(indexFile(), readIndex())
    onSaved(c.cwd)
  } catch (err) {
    console.error('[agentChats] não deu para gravar a conversa:', errorMessage(err))
  }
}

// Imagens enviadas em cada mensagem sua (data URLs), fora do arquivo principal: pesam, e só são
// lidas quando alguém abre o preview.
export function saveImages(id: string, messageId: string, images: string[]): void {
  if (!images.length) return
  try {
    mkdirSync(root(), { recursive: true })
    const read = readJsonFile<Record<string, string[]>>(imagesOf(id))
    const all = read.status === 'ok' && read.data ? read.data : {}
    all[messageId] = images
    writeJsonAtomicSync(imagesOf(id), all)
  } catch (err) {
    console.error('[agentChats] não deu para gravar as imagens:', errorMessage(err))
  }
}

export function loadImages(id: string, messageId: string): string[] {
  const read = readJsonFile<Record<string, string[]>>(imagesOf(id))
  return read.status === 'ok' ? (read.data?.[messageId] ?? []) : []
}

// Lixeira do sistema, como as do Claude: o arquivo da conversa e o das imagens. Volta restaurando
// pela Lixeira (e o índice reaparece na próxima gravação dela).
export async function trashConversation(id: string): Promise<string | null> {
  if (!readIndex()[id]) return tr('Conversa inválida.', 'Invalid chat.')
  try {
    for (const f of [fileOf(id), imagesOf(id)]) if (existsSync(f)) await shell.trashItem(f)
    delete readIndex()[id]
    writeJsonAtomicSync(indexFile(), readIndex())
    return null
  } catch (err) {
    return errorMessage(err)
  }
}
