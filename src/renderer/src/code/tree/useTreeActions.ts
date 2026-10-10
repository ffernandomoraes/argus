import { useEffect, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import type { FileEntry, FileOpResult } from '../../../../shared/files'
import type { ConfirmRequest } from '../../canvas/ConfirmDialog'
import type { MenuState } from '../../canvas/ContextMenu'
import { refreshNow } from '../../canvas/sessionsStore'
import { useStableCallback } from '../../lib/useStableCallback'
import { IS_WIN, isMod } from '../../platform'
import { moveDrafts } from '../drafts'
import type { Editing } from './FileTree'
import { treeMenu, type TreeMenuActions } from './treeMenu'
import { dirsUpTo, parentOf } from './treePaths'
import type { FileTree } from './useFileTree'

// A Lixeira do Windows abre direto da Área de Trabalho; a do Mac, pelo Finder.
const RECOVER = IS_WIN ? 'Dá para recuperar pela Lixeira.' : 'Dá para recuperar pelo Finder.'

type Options = {
  root: string
  tree: FileTree
  // Arquivo aberto (também por um link do chat): fica marcado na árvore.
  selected: string | null
  // A árvore volta a ter o foco depois de excluir ou cancelar um nome.
  treeRef: RefObject<HTMLDivElement | null>
  onOpenFile: (path: string) => void
  onRenamed: (from: string, to: string) => void
  onDeleted: (path: string) => void
}

// O que dá para fazer na árvore: criar, renomear, excluir (vai para a Lixeira), copiar e colar,
// inclusive arquivos copiados no Finder; pelo botão direito, pelos ícones do cabeçalho ou atalhos.
export function useTreeActions({ root, tree, selected, treeRef, onOpenFile, onRenamed, onDeleted }: Options) {
  const [focused, setFocused] = useState<string | null>(selected)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [prevSelected, setPrevSelected] = useState(selected)
  if (selected !== prevSelected) {
    setPrevSelected(selected)
    setFocused(selected)
  }

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(id)
  }, [error])

  // Pasta onde criar ou colar: a pasta em foco, ou a pasta do arquivo em foco, ou a raiz.
  const targetDir = (path: string | null) => (path === null ? '' : tree.isDir(path) ? path : parentOf(path))

  const done = (res: FileOpResult) => {
    if (!res.ok) setError(res.error)
    else refreshNow(root)
    return res.ok ? res.path : null
  }

  const startCreate = (dir: string, isDir: boolean) => {
    tree.expand(dir)
    setEditing({ kind: 'create', dir, isDir })
  }

  const submitEdit = async (value: string) => {
    const current = editing
    setEditing(null)
    if (!current) return
    if (current.kind === 'create') {
      const path = done(await window.api.files.create(root, current.dir, value, current.isDir))
      if (path === null) return
      // Nome com subpastas ("src/novo.ts"): abre o caminho até o item criado.
      for (const dir of dirsUpTo(path, current.dir)) tree.expand(dir)
      tree.load(current.dir)
      setFocused(path)
      if (!current.isDir) onOpenFile(path)
    } else {
      const path = done(await window.api.files.rename(root, current.path, value))
      if (path === null) return
      moveDrafts(root, current.path, path)
      tree.renameDirs(current.path, path)
      tree.load(parentOf(current.path))
      setFocused(path)
      onRenamed(current.path, path)
    }
  }

  const askDelete = (entry: FileEntry) =>
    setConfirm({
      title: `Excluir ${entry.isDir ? 'a pasta' : 'o arquivo'} "${entry.name}"?`,
      description: entry.isDir ? `A pasta e tudo o que há dentro dela vão para a Lixeira. ${RECOVER}` : `O arquivo vai para a Lixeira. ${RECOVER}`,
      confirmLabel: 'Mover para a Lixeira',
      onConfirm: () => {
        void (async () => {
          if (done(await window.api.files.trash(root, entry.path)) === null) return
          moveDrafts(root, entry.path, null)
          tree.forgetDirs(entry.path)
          tree.load(parentOf(entry.path))
          setFocused(null)
          onDeleted(entry.path)
          treeRef.current?.focus()
        })()
      }
    })

  const paste = async (dir: string) => {
    const path = done(await window.api.files.paste(root, dir))
    if (path === null) return
    tree.expand(dir)
    tree.load(dir)
    setFocused(path)
  }

  const menuActions: TreeMenuActions = {
    create: startCreate,
    copy: (path) => void window.api.files.copy(root, [path]),
    paste: (dir) => void paste(dir),
    copyPath: (path) => void navigator.clipboard.writeText(path),
    rename: (path) => setEditing({ kind: 'rename', path }),
    reveal: (path) => window.api.files.reveal(root, path),
    remove: askDelete
  }

  const openMenu = (e: MouseEvent, entry: FileEntry | null) => {
    e.preventDefault()
    e.stopPropagation()
    setFocused(entry?.path ?? null)
    setMenu({ x: e.clientX, y: e.clientY, items: treeMenu(entry, menuActions) })
  }

  // Atalhos com a árvore em foco: ⌘C copia, ⌘V cola, Enter renomeia, ⌘⌫ exclui. No Windows,
  // Ctrl+C e Ctrl+V, e também o F2 para renomear e o Delete para excluir, como no Explorador.
  // O preventDefault impede que o menu Editar do app trate o mesmo ⌘C / ⌘V.
  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) return
    const entry = tree.entryOf(focused)
    if (isMod(e) && e.key === 'v') {
      e.preventDefault()
      void paste(targetDir(focused))
    } else if (isMod(e) && e.key === 'c' && entry) {
      e.preventDefault()
      menuActions.copy(entry.path)
    } else if ((e.key === 'Enter' || (IS_WIN && e.key === 'F2')) && entry) {
      e.preventDefault()
      setEditing({ kind: 'rename', path: entry.path })
    } else if ((IS_WIN ? e.key === 'Delete' : e.metaKey && e.key === 'Backspace') && entry) {
      e.preventDefault()
      askDelete(entry)
    }
  }

  const onItemClick = useStableCallback((entry: FileEntry) => {
    setFocused(entry.path)
    if (!entry.isDir) return onOpenFile(entry.path)
    tree.toggle(entry.path)
  })
  const onItemMenu = useStableCallback(openMenu)
  const onSubmitEdit = useStableCallback((name: string) => void submitEdit(name))
  const onCancelEdit = useStableCallback(() => {
    setEditing(null)
    treeRef.current?.focus()
  })

  return {
    focused,
    setFocused,
    editing,
    menu,
    closeMenu: () => setMenu(null),
    confirm,
    closeConfirm: () => setConfirm(null),
    error,
    targetDir,
    startCreate,
    openMenu,
    onKeyDown,
    onItemClick,
    onItemMenu,
    onSubmitEdit,
    onCancelEdit
  }
}
