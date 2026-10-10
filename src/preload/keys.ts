import type { EditAction } from '../shared/ipc'
import { listen } from './ipc'

const IS_WIN = process.platform === 'win32'

// Desfazer e refazer. No Mac chegam pelo menu Editar (⌘Z, ⇧⌘Z). O Windows não tem menu: Ctrl+Z,
// Ctrl+Shift+Z e Ctrl+Y fazem o papel dele e chegam do mesmo jeito. Sem ninguém escutando (janela
// de conversa) ou no terminal e no editor de código, que têm o desfazer deles, a tecla segue normal.
const editListeners = new Set<(action: EditAction) => void>()
listen('edit', (action) => editListeners.forEach((l) => l(action)))
if (IS_WIN) {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || !editListeners.size) return
      const key = e.key.toLowerCase()
      const action: EditAction | null = key === 'z' ? (e.shiftKey ? 'redo' : 'undo') : key === 'y' && !e.shiftKey ? 'redo' : null
      if (!action || (e.target as Element | null)?.closest?.('.xterm, .cm-editor')) return
      e.preventDefault()
      editListeners.forEach((l) => l(action))
    },
    true
  )
}

export function onEdit(cb: (action: EditAction) => void): () => void {
  editListeners.add(cb)
  return () => {
    editListeners.delete(cb)
  }
}

// Recarregar (⌘R no menu Ver; no Windows, Ctrl+R). Com alguém escutando (a página do protótipo
// aberta no modo design), recarrega só ela; sem ninguém, no Mac recarrega a janela, como antes.
const reloadListeners: (() => void)[] = []
const reloadKey = (): boolean => {
  const top = reloadListeners[reloadListeners.length - 1]
  if (!top) return false
  top()
  return true
}
listen('reload-request', () => {
  if (!reloadKey()) location.reload()
})
if (IS_WIN) {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.key.toLowerCase() !== 'r') return
      if (reloadKey()) e.preventDefault()
    },
    true
  )
}

export function onReloadKey(cb: () => void): () => void {
  reloadListeners.push(cb)
  return () => {
    const i = reloadListeners.lastIndexOf(cb)
    if (i >= 0) reloadListeners.splice(i, 1)
  }
}
