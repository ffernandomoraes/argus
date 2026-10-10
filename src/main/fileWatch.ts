import { watch, type FSWatcher } from 'node:fs'
import type { WebContents } from 'electron'
import { sendTo } from './ipc/events'
import { insideRoot } from './paths'

// Um arquivo vigiado por janela: o que está aberto no visualizador de código.
// Mudou no disco (o Claude editou, por exemplo), a janela é avisada para recarregar.
type Entry = { root: string; rel: string; full: string; watcher?: FSWatcher; timer?: NodeJS.Timeout; retries: number }

const watchers = new Map<number, Entry>()
// Janelas com o aviso de fechada já registrado: um por janela, não um a cada arquivo aberto.
const tracked = new WeakSet<WebContents>()

// Editores gravam em vários passos: espera assentar antes de avisar.
const SETTLE_MS = 150
// Na gravação atômica o arquivo some por um instante (o editor grava um temporário e troca):
// tenta religar algumas vezes antes de desistir.
const RETRY_MS = 200
const RETRIES = 10

export function unwatchFile(sender: WebContents): void {
  const current = watchers.get(sender.id)
  if (!current) return
  clearTimeout(current.timer)
  current.watcher?.close()
  watchers.delete(sender.id)
}

export function watchFile(sender: WebContents, root: string, rel: string): void {
  unwatchFile(sender)
  const full = insideRoot(root, rel)
  if (!full) return
  if (!tracked.has(sender)) {
    tracked.add(sender)
    sender.once('destroyed', () => unwatchFile(sender))
  }
  const entry: Entry = { root, rel, full, retries: 0 }
  watchers.set(sender.id, entry)
  arm(sender, entry, false)
}

// Liga o vigia. `changed`: o arquivo voltou depois de sumir, com outro conteúdo.
function arm(sender: WebContents, entry: Entry, changed: boolean): void {
  if (watchers.get(sender.id) !== entry || sender.isDestroyed()) return
  entry.watcher?.close()
  entry.watcher = undefined
  try {
    entry.watcher = watch(entry.full, () => settle(sender, entry))
    entry.watcher.on('error', () => retry(sender, entry))
    entry.retries = 0
    if (changed) sendTo(sender, 'files:changed', entry.root, entry.rel)
  } catch {
    retry(sender, entry)
  }
}

function retry(sender: WebContents, entry: Entry): void {
  entry.watcher?.close()
  entry.watcher = undefined
  clearTimeout(entry.timer)
  if (entry.retries++ < RETRIES) entry.timer = setTimeout(() => arm(sender, entry, true), RETRY_MS)
}

function settle(sender: WebContents, entry: Entry): void {
  clearTimeout(entry.timer)
  entry.timer = setTimeout(() => {
    if (watchers.get(sender.id) !== entry || sender.isDestroyed()) return
    sendTo(sender, 'files:changed', entry.root, entry.rel)
    // Quem grava num temporário e troca o arquivo deixa a vigia presa ao antigo: recomeça.
    arm(sender, entry, false)
  }, SETTLE_MS)
}
