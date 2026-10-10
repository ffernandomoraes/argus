import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import type { FileEntry } from '../../../../shared/files'
import { inside, renamedDirs } from './treePaths'

// Conteúdo de cada pasta já aberta, pelo caminho ('' = raiz), e as pastas abertas. Guardado com a
// pasta do projeto: trocar de projeto começa do zero, e uma resposta atrasada da pasta anterior não
// entra na nova.
type Tree = { root: string; listings: Readonly<Record<string, FileEntry[]>>; expanded: ReadonlySet<string> }

const emptyTree = (root: string): Tree => ({ root, listings: {}, expanded: new Set() })

// Árvore de pastas e arquivos do projeto, carregada sob demanda.
export function useFileTree(root: string) {
  const [tree, setTree] = useState(() => emptyTree(root))
  if (tree.root !== root) setTree(emptyTree(root))
  const { listings, expanded } = tree

  const load = useCallback(
    (dir: string) => {
      window.api.files.list(root, dir).then(
        (entries) => setTree((t) => (t.root === root ? { ...t, listings: { ...t.listings, [dir]: entries } } : t)),
        (err: unknown) => console.error('[código] listar pasta:', err)
      )
    },
    [root]
  )

  useEffect(() => load(''), [load])

  // Relê a raiz e as pastas abertas: depois de uma mudança e ao voltar para a janela
  // (arquivos criados no Finder ou pelo Claude enquanto isso).
  const reloadAll = () => {
    load('')
    for (const dir of expanded) load(dir)
  }
  const onFocus = useEffectEvent(reloadAll)
  useEffect(() => {
    const listener = () => onFocus()
    window.addEventListener('focus', listener)
    return () => window.removeEventListener('focus', listener)
  }, [])

  const setExpanded = (update: (dirs: ReadonlySet<string>) => ReadonlySet<string>) =>
    setTree((t) => (t.root === root ? { ...t, expanded: update(t.expanded) } : t))

  const expand = (dir: string) => {
    if (!dir) return
    setExpanded((s) => new Set(s).add(dir))
    load(dir)
  }

  const toggle = (dir: string) => {
    const open = expanded.has(dir)
    setExpanded((s) => {
      const next = new Set(s)
      if (open) next.delete(dir)
      else next.add(dir)
      return next
    })
    if (!open) load(dir)
  }

  const all = () => Object.values(listings).flat()

  return {
    listings,
    expanded,
    load,
    reloadAll,
    expand,
    toggle,
    // Renomeado: as pastas abertas dentro dele continuam abertas com o nome novo.
    renameDirs: (from: string, to: string) => setExpanded((s) => renamedDirs(s, from, to)),
    // Excluído: as pastas dentro dele saem da lista das abertas.
    forgetDirs: (path: string) => setExpanded((s) => new Set([...s].filter((d) => !inside(d, path)))),
    entryOf: (path: string | null) => (path === null ? null : (all().find((e) => e.path === path) ?? null)),
    isDir: (path: string) => all().some((e) => e.path === path && e.isDir)
  }
}

export type FileTree = ReturnType<typeof useFileTree>
