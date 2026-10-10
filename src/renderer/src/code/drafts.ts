import type { Text } from '@codemirror/state'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Edição ainda não salva (⌘S), por arquivo. Trocar de arquivo ou fechar o painel não perde
// o que foi digitado: ao reabrir, o editor volta com o rascunho. Some ao fechar o app (que pergunta
// antes, ver reportUnsaved).
// `base`: o texto do disco quando a edição começou (como está no disco, com o fim de linha dele),
// para saber se o arquivo mudou por fora.
export type Draft = { base: string; doc: Text }

// Por pasta do projeto e, dentro dela, por arquivo. Uma chave só ("pasta|arquivo") quebrava com
// "|" no nome ao renomear uma pasta. Nenhuma pasta fica com o Map vazio.
const drafts = new Map<string, Map<string, Draft>>()

// O que a tela usa: quais arquivos de cada pasta têm rascunho. Muda só quando um arquivo passa a
// ter (ou deixa de ter) rascunho; o texto de cada um fica no Map acima, e digitar não avisa ninguém.
const EMPTY: ReadonlySet<string> = new Set()
const marked = createStore<ReadonlyMap<string, ReadonlySet<string>>>(new Map())

// O processo principal pergunta antes de fechar ou atualizar o app quando há rascunho (ele só
// existe aqui, na memória da janela). Avisa só quando muda.
let reported = false
function reportUnsaved(): void {
  const has = drafts.size > 0
  if (has === reported) return
  reported = has
  window.api.files.setUnsaved(has)
}

function publish(root: string): void {
  reportUnsaved()
  const files = drafts.get(root)
  marked.set((m) => {
    const next = new Map(m)
    if (files) next.set(root, new Set(files.keys()))
    else next.delete(root)
    return next
  })
}

export function getDraft(root: string, path: string): Draft | undefined {
  return drafts.get(root)?.get(path)
}

export function setDraft(root: string, path: string, draft: Draft | null): void {
  let files = drafts.get(root)
  const had = !!files?.has(path)
  if (draft) {
    if (!files) drafts.set(root, (files = new Map()))
    files.set(path, draft)
  } else if (files) {
    files.delete(path)
    if (!files.size) drafts.delete(root)
  }
  // A árvore só precisa saber quando um arquivo passa a ter (ou deixa de ter) rascunho.
  if (had !== !!draft) publish(root)
}

// Algum arquivo, em qualquer pasta, com alteração não salva.
export function hasDrafts(): boolean {
  return drafts.size > 0
}

// Renomear ou excluir uma pasta leva junto os rascunhos dos arquivos dentro dela.
export function moveDrafts(root: string, from: string, to: string | null): void {
  const files = drafts.get(root)
  if (!files) return
  let changed = false
  for (const [path, draft] of [...files]) {
    if (path !== from && !path.startsWith(from + '/')) continue
    files.delete(path)
    if (to !== null) files.set(to + path.slice(from.length), draft)
    changed = true
  }
  if (!changed) return
  if (!files.size) drafts.delete(root)
  publish(root)
}

// Caminhos com rascunho na pasta; a árvore marca esses arquivos com um ponto. A mesma referência
// enquanto a lista não muda.
export function useDraftPaths(root: string): ReadonlySet<string> {
  return useStore(marked, (m) => m.get(root) ?? EMPTY)
}
