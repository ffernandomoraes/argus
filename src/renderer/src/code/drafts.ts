import { useSyncExternalStore } from 'react'
import type { Text } from '@codemirror/state'

// Edição ainda não salva (⌘S), por arquivo. Trocar de arquivo ou fechar o painel não perde
// o que foi digitado: ao reabrir, o editor volta com o rascunho. Some ao fechar o app.
// `base`: o texto do disco quando a edição começou, para saber se o arquivo mudou por fora.
export type Draft = { base: string; doc: Text }

const drafts = new Map<string, Draft>()
const listeners = new Set<() => void>()
let version = 0

const keyOf = (root: string, path: string) => `${root}|${path}`
const notify = () => {
  version++
  listeners.forEach((l) => l())
}

export function getDraft(root: string, path: string): Draft | undefined {
  return drafts.get(keyOf(root, path))
}

export function setDraft(root: string, path: string, draft: Draft | null): void {
  const key = keyOf(root, path)
  const had = drafts.has(key)
  if (draft) drafts.set(key, draft)
  else drafts.delete(key)
  // A árvore só precisa saber quando um arquivo passa a ter (ou deixa de ter) rascunho.
  if (had !== !!draft) notify()
}

// Renomear ou excluir uma pasta leva junto os rascunhos dos arquivos dentro dela.
export function moveDrafts(root: string, from: string, to: string | null): void {
  let changed = false
  for (const [key, draft] of [...drafts]) {
    const [r, p] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)]
    if (r !== root || (p !== from && !p.startsWith(from + '/'))) continue
    drafts.delete(key)
    if (to !== null) drafts.set(keyOf(root, to + p.slice(from.length)), draft)
    changed = true
  }
  if (changed) notify()
}

// Caminhos com rascunho na raiz; a árvore marca esses arquivos com um ponto.
export function useDraftPaths(root: string): Set<string> {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version
  )
  const prefix = `${root}|`
  return new Set([...drafts.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)))
}
