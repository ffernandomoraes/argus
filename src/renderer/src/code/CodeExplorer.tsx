import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  ClipboardPaste,
  Copy,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  Link,
  Pencil,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react'
import type { FileEntry, FileOpResult } from '../../../shared/files'
import { useEscape } from '../useEscape'
import { PANEL_TOP } from '../conversation/FloatingPanel'
import { ContextMenu, type MenuItem, type MenuState } from '../canvas/ContextMenu'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import { moveDrafts, useDraftPaths } from './drafts'
import { refreshNow, useUncommitted } from '../canvas/sessionsStore'
import { KIND_COLOR, KIND_LABEL } from '../conversation/ConversationView'
import type { UncommittedFile } from '../../../shared/sessions'
import { Presence } from '../motion'
import { FILE_MANAGER, IS_WIN, isMod, relativeTo, untildify } from '../platform'

// A Lixeira do Windows abre direto da Área de Trabalho; a do Mac, pelo Finder.
const RECOVER = IS_WIN ? 'Dá para recuperar pela Lixeira.' : 'Dá para recuperar pelo Finder.'

type Kind = UncommittedFile['kind']
// Pasta com mudanças dentro: o tipo mais importante entre elas dá a cor, como no VS Code.
const KIND_RANK: Kind[] = ['!', 'M', 'R', 'D', 'A', 'U']

// Arquivos não comitados (caminhos absolutos do git) → caminho na árvore e tipo da mudança,
// com as pastas que os contêm. O que está fora da pasta do projeto fica de fora.
function changesInTree(root: string, files: UncommittedFile[] | null): Map<string, Kind> {
  const out = new Map<string, Kind>()
  if (!files) return out
  const base = untildify(root)
  for (const f of files) {
    const rel = relativeTo(f.path, base)
    if (!rel) continue
    out.set(rel, f.kind)
    for (let dir = parentOf(rel); dir; dir = parentOf(dir)) {
      const current = out.get(dir)
      if (!current || KIND_RANK.indexOf(f.kind) < KIND_RANK.indexOf(current)) out.set(dir, f.kind)
    }
  }
  return out
}

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const inside = (path: string, dir: string) => path === dir || path.startsWith(dir + '/')

// Criação ou renomeação em andamento: um campo de nome no lugar da linha.
type Editing = { kind: 'create'; dir: string; isDir: boolean } | { kind: 'rename'; path: string }

const indent = (depth: number) => 8 + depth * 12

// Campo de nome dentro da árvore. Enter ou clicar fora confirma; ESC cancela.
function NameInput({
  depth,
  isDir,
  initial,
  onSubmit,
  onCancel
}: {
  depth: number
  isDir: boolean
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const done = useRef(false)
  const finish = (value: string | null) => {
    if (done.current) return
    done.current = true
    const name = value?.trim()
    if (name && name !== initial) onSubmit(name)
    else onCancel()
  }
  const Icon = isDir ? Folder : File

  return (
    <div style={{ paddingLeft: indent(depth) + 16 }} className="flex items-center gap-1.5 py-0.5 pr-2">
      <Icon size={13} className="shrink-0 text-faint" />
      <input
        autoFocus
        defaultValue={initial}
        spellCheck={false}
        // Renomear seleciona só o nome, sem a extensão, como o Finder.
        onFocus={(e) => {
          const dot = initial.lastIndexOf('.')
          e.currentTarget.setSelectionRange(0, !isDir && dot > 0 ? dot : initial.length)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') finish(e.currentTarget.value)
          else if (e.key === 'Escape') {
            e.preventDefault()
            finish(null)
          }
        }}
        onBlur={(e) => finish(e.currentTarget.value)}
        className="min-w-0 flex-1 rounded border border-accent bg-bg px-1.5 py-0.5 text-xs text-text outline-none"
      />
    </div>
  )
}

type TreeProps = {
  listings: Record<string, FileEntry[]>
  expanded: Set<string>
  focused: string | null
  drafts: Set<string>
  // Não comitado: o nome ganha a cor do VS Code (amarelo alterado, verde novo) e a letra à direita.
  changes: Map<string, Kind>
  editing: Editing | null
  onClick: (entry: FileEntry) => void
  onContextMenu: (e: MouseEvent, entry: FileEntry) => void
  onSubmitEdit: (name: string) => void
  onCancelEdit: () => void
}

function TreeItem({ entry, depth, ...p }: TreeProps & { entry: FileEntry; depth: number }) {
  const open = entry.isDir && p.expanded.has(entry.path)
  const children = p.listings[entry.path]
  const Icon = entry.isDir ? (open ? FolderOpen : Folder) : File
  const change = p.changes.get(entry.path)

  if (p.editing?.kind === 'rename' && p.editing.path === entry.path) {
    return (
      <li>
        <NameInput depth={depth} isDir={entry.isDir} initial={entry.name} onSubmit={p.onSubmitEdit} onCancel={p.onCancelEdit} />
      </li>
    )
  }

  return (
    <li>
      <button
        onClick={() => p.onClick(entry)}
        onContextMenu={(e) => p.onContextMenu(e, entry)}
        data-path={entry.path}
        style={{ paddingLeft: indent(depth) }}
        className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs outline-none ${
          p.focused === entry.path ? 'bg-selection text-white [&_span]:text-white [&_svg]:text-white' : 'text-muted hover:bg-fill hover:text-text'
        } ${entry.ignored ? 'opacity-50' : ''}`}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${entry.isDir ? '' : 'invisible'} ${open ? 'rotate-90' : ''}`}
        />
        <Icon size={13} className="shrink-0 text-faint" />
        <span className={`truncate ${change ? KIND_COLOR[change] : ''}`}>{entry.name}</span>
        <span className="ml-auto" />
        {p.drafts.has(entry.path) && (
          <span title="Alterações não salvas" className="size-1.5 shrink-0 rounded-full bg-text" />
        )}
        {change &&
          (entry.isDir ? (
            <span title="Tem mudanças não comitadas" className={`size-1.5 shrink-0 rounded-full bg-current ${KIND_COLOR[change]}`} />
          ) : (
            <span title={KIND_LABEL[change]} className={`shrink-0 font-mono text-[12px] font-semibold ${KIND_COLOR[change]}`}>
              {change}
            </span>
          ))}
      </button>
      {open && <TreeList dir={entry.path} entries={children} depth={depth + 1} {...p} />}
    </li>
  )
}

function TreeList({ dir, entries, depth, ...p }: TreeProps & { dir: string; entries?: FileEntry[]; depth: number }) {
  const creating = p.editing?.kind === 'create' && p.editing.dir === dir ? p.editing : null
  return (
    <ul>
      {creating && (
        <li>
          <NameInput depth={depth} isDir={creating.isDir} initial="" onSubmit={p.onSubmitEdit} onCancel={p.onCancelEdit} />
        </li>
      )}
      {entries?.map((e) => <TreeItem key={e.path} entry={e} depth={depth} {...p} />)}
      {entries?.length === 0 && !creating && (
        <li style={{ paddingLeft: indent(depth) + 24 }} className="py-1 text-[12px] text-faint">
          vazia
        </li>
      )}
    </ul>
  )
}

// Painel de código: árvore de pastas e arquivos do projeto (carregada sob demanda) e, com um
// arquivo aberto, o conteúdo dele ao lado, no mesmo painel, que então se estica até a conversa.
// Na árvore dá para criar, renomear, excluir (vai para a Lixeira), copiar e colar, inclusive
// arquivos copiados no Finder: botão direito, os ícones do cabeçalho ou os atalhos.
export function CodeExplorer({
  root,
  name,
  selected,
  rightOffset,
  onOpenFile,
  onRenamed,
  onDeleted,
  onClose,
  children
}: {
  root: string
  name: string
  selected: string | null
  // Espaço ocupado pelo painel da conversa à direita; vale só com arquivo aberto.
  rightOffset: number | string
  onOpenFile: (path: string) => void
  // Item renomeado ou excluído: o arquivo aberto pode ser ele ou estar dentro dele.
  onRenamed: (from: string, to: string) => void
  onDeleted: (path: string) => void
  onClose: () => void
  // Arquivo aberto (FileViewer), mostrado à direita da árvore.
  children?: ReactNode
}) {
  // Conteúdo de cada pasta já aberta, pelo caminho ('' = raiz).
  const [listings, setListings] = useState<Record<string, FileEntry[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<string | null>(selected)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const drafts = useDraftPaths(root)
  const uncommitted = useUncommitted(root)
  const changes = useMemo(() => changesInTree(root, uncommitted), [root, uncommitted])
  const treeRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded
  useEscape(onClose)

  const load = useCallback(
    (dir: string) =>
      window.api.files.list(root, dir).then((entries) => setListings((l) => ({ ...l, [dir]: entries }))),
    [root]
  )
  // Relê a raiz e as pastas abertas: depois de uma mudança e ao voltar para a janela
  // (arquivos criados no Finder ou pelo Claude enquanto isso).
  const reloadAll = useCallback(() => {
    load('')
    expandedRef.current.forEach((dir) => load(dir))
  }, [load])

  useEffect(() => {
    setListings({})
    setExpanded(new Set())
    load('')
  }, [load])

  useEffect(() => {
    window.addEventListener('focus', reloadAll)
    return () => window.removeEventListener('focus', reloadAll)
  }, [reloadAll])

  // Arquivo aberto por um link do chat também fica marcado na árvore.
  useEffect(() => setFocused(selected), [selected])

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(id)
  }, [error])

  const isDirPath = (path: string) => Object.values(listings).some((l) => l.some((e) => e.path === path && e.isDir))
  // Pasta onde criar ou colar: a pasta em foco, ou a pasta do arquivo em foco, ou a raiz.
  const targetDir = (path: string | null) => (path === null ? '' : isDirPath(path) ? path : parentOf(path))

  const expand = (dir: string) => {
    if (!dir) return
    setExpanded((s) => new Set([...s, dir]))
    load(dir)
  }

  const done = (res: FileOpResult) => {
    if (!res.ok) setError(res.error)
    else refreshNow(root)
    return res.ok ? res.path : null
  }

  const onClick = (entry: FileEntry) => {
    setFocused(entry.path)
    if (!entry.isDir) return onOpenFile(entry.path)
    const open = expanded.has(entry.path)
    setExpanded((s) => {
      const next = new Set(s)
      if (open) next.delete(entry.path)
      else next.add(entry.path)
      return next
    })
    if (!open) load(entry.path)
  }

  const startCreate = (dir: string, isDir: boolean) => {
    expand(dir)
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
      parentOf(path)
        .split('/')
        .reduce((acc, part) => {
          const dir = acc ? `${acc}/${part}` : part
          if (dir && dir !== current.dir) expand(dir)
          return dir
        }, '')
      load(current.dir)
      setFocused(path)
      if (!current.isDir) onOpenFile(path)
    } else {
      const path = done(await window.api.files.rename(root, current.path, value))
      if (path === null) return
      moveDrafts(root, current.path, path)
      setExpanded((s) => new Set([...s].map((d) => (inside(d, current.path) ? path + d.slice(current.path.length) : d))))
      load(parentOf(current.path))
      setFocused(path)
      onRenamed(current.path, path)
    }
  }

  const askDelete = (entry: FileEntry) =>
    setConfirm({
      title: `Excluir ${entry.isDir ? 'a pasta' : 'o arquivo'} "${entry.name}"?`,
      description: entry.isDir
        ? `A pasta e tudo o que há dentro dela vão para a Lixeira. ${RECOVER}`
        : `O arquivo vai para a Lixeira. ${RECOVER}`,
      confirmLabel: 'Mover para a Lixeira',
      onConfirm: async () => {
        if (done(await window.api.files.trash(root, entry.path)) === null) return
        moveDrafts(root, entry.path, null)
        setExpanded((s) => new Set([...s].filter((d) => !inside(d, entry.path))))
        load(parentOf(entry.path))
        setFocused(null)
        onDeleted(entry.path)
        treeRef.current?.focus()
      }
    })

  const paste = async (dir: string) => {
    const path = done(await window.api.files.paste(root, dir))
    if (path === null) return
    expand(dir)
    load(dir)
    setFocused(path)
  }

  const entryOf = (path: string | null) =>
    path === null ? null : (Object.values(listings).flat().find((e) => e.path === path) ?? null)

  const menuFor = (entry: FileEntry | null): MenuItem[] => {
    const dir = entry ? (entry.isDir ? entry.path : parentOf(entry.path)) : ''
    const items: MenuItem[] = [
      { type: 'action', label: 'Novo arquivo', icon: FilePlus, onSelect: () => startCreate(dir, false) },
      { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => startCreate(dir, true) },
      { type: 'separator' }
    ]
    if (entry) items.push({ type: 'action', label: 'Copiar', icon: Copy, onSelect: () => window.api.files.copy(root, [entry.path]) })
    items.push({ type: 'action', label: 'Colar', icon: ClipboardPaste, onSelect: () => paste(dir) })
    if (entry) {
      items.push(
        { type: 'separator' },
        {
          type: 'action',
          label: 'Copiar caminho relativo',
          icon: Link,
          onSelect: () => navigator.clipboard.writeText(entry.path)
        },
        { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => setEditing({ kind: 'rename', path: entry.path }) }
      )
    }
    items.push({
      type: 'action',
      label: `Mostrar no ${FILE_MANAGER}`,
      icon: FolderSearch,
      onSelect: () => window.api.files.reveal(root, entry?.path ?? '')
    })
    if (entry) items.push({ type: 'separator' }, { type: 'action', label: 'Excluir', icon: Trash2, danger: true, onSelect: () => askDelete(entry) })
    return items
  }

  const openMenu = (e: MouseEvent, entry: FileEntry | null) => {
    e.preventDefault()
    e.stopPropagation()
    setFocused(entry?.path ?? null)
    setMenu({ x: e.clientX, y: e.clientY, items: menuFor(entry) })
  }

  // Atalhos com a árvore em foco: ⌘C copia, ⌘V cola, Enter renomeia, ⌘⌫ exclui. No Windows,
  // Ctrl+C e Ctrl+V, e também o F2 para renomear e o Delete para excluir, como no Explorador.
  // O preventDefault impede que o menu Editar do app trate o mesmo ⌘C / ⌘V.
  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) return
    const entry = entryOf(focused)
    if (isMod(e) && e.key === 'v') {
      e.preventDefault()
      paste(targetDir(focused))
    } else if (isMod(e) && e.key === 'c' && entry) {
      e.preventDefault()
      window.api.files.copy(root, [entry.path])
    } else if ((e.key === 'Enter' || (IS_WIN && e.key === 'F2')) && entry) {
      e.preventDefault()
      setEditing({ kind: 'rename', path: entry.path })
    } else if ((IS_WIN ? e.key === 'Delete' : e.metaKey && e.key === 'Backspace') && entry) {
      e.preventDefault()
      askDelete(entry)
    }
  }

  const treeProps: TreeProps = {
    listings,
    expanded,
    focused,
    drafts,
    changes,
    editing,
    onClick,
    onContextMenu: openMenu,
    onSubmitEdit: submitEdit,
    onCancelEdit: () => {
      setEditing(null)
      treeRef.current?.focus()
    }
  }
  const rootEntries = listings['']

  return (
    <aside
      style={{ top: PANEL_TOP, ...(children ? { right: rightOffset } : { width: 280 }) }}
      className="absolute bottom-2 left-2 z-40 flex overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
    >
      <div className={`flex w-[280px] shrink-0 flex-col ${children ? 'border-r border-line' : ''}`}>
        <header className="flex h-12 items-center gap-1 border-b border-line pr-3 pl-3">
          <Folder size={14} className="mr-1 shrink-0 text-muted" />
          <span className="flex-1 truncate text-sm font-medium">{name}</span>
          <HeaderButton label="Novo arquivo" onClick={() => startCreate(targetDir(focused), false)}>
            <FilePlus size={14} />
          </HeaderButton>
          <HeaderButton label="Nova pasta" onClick={() => startCreate(targetDir(focused), true)}>
            <FolderPlus size={14} />
          </HeaderButton>
          <HeaderButton label="Atualizar" onClick={reloadAll}>
            <RefreshCw size={13} />
          </HeaderButton>
          {/* Com arquivo aberto, o X fica no canto do painel, no cabeçalho do arquivo. */}
          {!children && <CloseCodeButton onClick={onClose} />}
        </header>
        <div
          ref={treeRef}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onContextMenu={(e) => openMenu(e, null)}
          // Clicar no vazio tira o foco do item: criar e colar passam a valer para a raiz.
          onMouseDown={(e) => e.target === e.currentTarget && setFocused(null)}
          className="min-h-0 flex-1 overflow-y-auto p-1.5 outline-none"
        >
          {!rootEntries && <p className="px-2 py-1 text-xs text-faint">Carregando…</p>}
          {rootEntries?.length === 0 && !editing && <p className="px-2 py-1 text-xs text-faint">Pasta vazia ou inexistente</p>}
          {rootEntries && <TreeList dir="" entries={rootEntries} depth={0} {...treeProps} />}
        </div>
        {error && (
          <p role="alert" className="border-t border-line px-3 py-2 text-[12px] text-red-400">
            {error}
          </p>
        )}
      </div>
      {children}
      {/* No body: o painel da conversa, na mesma camada e depois no DOM, cobriria os dois. */}
      {createPortal(
        <Presence kind="menu">{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}</Presence>,
        document.body
      )}
      {createPortal(
        <Presence kind="modal">{confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}</Presence>,
        document.body
      )}
    </aside>
  )
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
    >
      {children}
    </button>
  )
}

export function CloseCodeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Fechar código"
      title="Fechar código"
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
    >
      <X size={15} />
    </button>
  )
}
