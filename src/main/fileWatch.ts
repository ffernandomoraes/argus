import { watch, type FSWatcher } from 'node:fs'
import type { WebContents } from 'electron'
import { insideRoot } from './paths'

// Um arquivo vigiado por janela: o que está aberto no visualizador de código.
// Mudou no disco (o Claude editou, por exemplo), a janela é avisada para recarregar.
const watchers = new Map<number, { watcher: FSWatcher; timer?: NodeJS.Timeout }>()

export function unwatchFile(sender: WebContents): void {
  const current = watchers.get(sender.id)
  if (!current) return
  clearTimeout(current.timer)
  current.watcher.close()
  watchers.delete(sender.id)
}

export function watchFile(sender: WebContents, root: string, rel: string): void {
  unwatchFile(sender)
  const full = insideRoot(root, rel)
  if (!full) return
  try {
    const entry: { watcher: FSWatcher; timer?: NodeJS.Timeout } = {
      watcher: watch(full, () => {
        // Editores gravam em vários passos: espera assentar antes de avisar.
        clearTimeout(entry.timer)
        entry.timer = setTimeout(() => {
          if (sender.isDestroyed()) return
          sender.send('files:changed', root, rel)
          // Quem grava num temporário e troca o arquivo deixa a vigia presa ao antigo: recomeça.
          watchFile(sender, root, rel)
        }, 150)
      })
    }
    entry.watcher.on('error', () => unwatchFile(sender))
    watchers.set(sender.id, entry)
    sender.once('destroyed', () => unwatchFile(sender))
  } catch {
    // arquivo sumiu
  }
}
