import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, Folder, FolderOpen, Search } from 'lucide-react'
import type { KnownFolder } from '../../../shared/sessions'
import { IS_WIN, lastSep, parentDir } from '../platform'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { TimeAgo } from './blocks/TimeAgo'
import { displayPath } from './factory'
import { tr } from '../i18n'

// "Nova pasta": as pastas onde o Claude Code já conversou, da mais recente para a mais antiga,
// para não confundir pastas de nome parecido no seletor do sistema. Pasta sem conversa
// entra por "Escolher outra pasta…". Com onPickMany ("Novo workspace"), marca várias e cria um
// card só com elas.
export function FolderPicker({
  onCanvas,
  onPick,
  onPickMany,
  onClose
}: {
  // Pastas já no canvas (como displayPath): aparecem marcadas, mas dá para adicionar de novo.
  onCanvas: Set<string>
  // Caminho absoluto da pasta escolhida.
  onPick: (folder: string) => void
  // Workspace: as pastas marcadas, na ordem em que foram marcadas.
  onPickMany?: (folders: string[]) => void
  onClose: () => void
}) {
  const multiple = !!onPickMany
  const [folders, setFolders] = useState<KnownFolder[] | null>(null)
  // Workspace: pastas marcadas e as escolhidas pelo seletor do sistema (entram no topo da lista).
  const [selected, setSelected] = useState<string[]>([])
  const [picked, setPicked] = useState<KnownFolder[]>([])
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  // Distros do WSL (só no Windows): cada uma ganha um atalho para escolher pasta no Linux dela.
  const [distros, setDistros] = useState<string[]>([])
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let alive = true
    void window.api.sessions.folders().then((all) => alive && setFolders(all))
    if (IS_WIN) void window.api.wsl.distros().then((d) => alive && setDistros(d), () => {})
    return () => {
      alive = false
    }
  }, [])

  const q = query.trim().toLowerCase()
  const known = folders ?? []
  const all = [...picked.filter((p) => !known.some((f) => f.path === p.path)), ...known]
  const matches = (f: KnownFolder) => !q || f.path.toLowerCase().includes(q)
  // Workspace: as marcadas que a busca esconderia ficam no topo, para o "N pastas marcadas" bater
  // com o que se vê (inclusive a escolhida pelo Finder). As que batem com a busca ficam no lugar.
  const hiddenChecked = multiple ? all.filter((f) => selected.includes(f.path) && !matches(f)) : []
  const shown = [...hiddenChecked, ...all.filter(matches)]
  const toggle = (path: string) => setSelected((s) => (s.includes(path) ? s.filter((p) => p !== path) : [...s, path]))
  // Uma pasta só não é workspace: a partir de duas.
  const create = () => selected.length >= 2 && onPickMany?.(selected)
  const choose = multiple ? toggle : onPick

  useEffect(() => {
    list.current?.children[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const pickOther = async (distro?: string) => {
    if (!multiple) {
      const folder = await window.api.pickFolder(distro)
      if (folder) onPick(folder)
      return
    }
    // Workspace: várias de uma vez no seletor do sistema, todas já marcadas.
    const chosen = await window.api.pickFolders(distro)
    if (!chosen.length) return
    setPicked((p) => [...chosen.filter((c) => !p.some((f) => f.path === c)).map((path) => ({ path, updatedAt: '' })), ...p])
    setSelected((s) => [...s, ...chosen.filter((c) => !s.includes(c))])
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, shown.length - 1))
    else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0))
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      // No workspace, Enter marca a pasta; ⌘Enter cria.
      if (multiple && (e.metaKey || e.ctrlKey)) create()
      else if (shown[highlight]) choose(shown[highlight].path)
    } else return
    e.preventDefault()
  }

  return (
    <Modal variant="palette" label={multiple ? tr('Novo espaço de trabalho', 'New workspace') : tr('Nova pasta', 'New folder')} className="flex flex-col" onClose={onClose}>
      {multiple && (
        <div className="shrink-0 border-b border-line px-3 py-2.5">
          <p className="text-sm font-medium text-text">{tr('Novo espaço de trabalho', 'New workspace')}</p>
          <p className="mt-0.5 text-xs text-muted">
            {tr(
              'Marque as pastas que as conversas vão enxergar. Só elas: o resto do computador fica de fora.',
              'Check the folders the chats will see. Only those: the rest of the computer stays out.'
            )}
          </p>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <Search size={15} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // A lista muda com a busca: o destaque volta para o primeiro.
            setHighlight(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={tr('Buscar pasta com conversa do Claude Code', 'Search folders with Claude Code chats')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>

      {folders === null && picked.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted">{tr('Lendo as conversas…', 'Reading chats…')}</p>
      ) : shown.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted">
          {query ? tr('Nenhuma pasta com esse nome.', 'No folder with that name.') : tr('Nenhuma pasta com conversa do Claude Code.', 'No folders with Claude Code chats.')}
        </p>
      ) : (
        <ul ref={list} className="min-h-0 flex-1 overflow-y-auto p-1">
          {shown.map((f, i) => (
            <FolderRow
              key={f.path}
              folder={f}
              index={i}
              highlighted={i === highlight}
              onCanvas={onCanvas}
              checked={multiple ? selected.includes(f.path) : undefined}
              onPick={choose}
              onHighlight={setHighlight}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => void pickOther()}
        className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-text"
      >
        <FolderOpen size={14} className="shrink-0" />
        {multiple ? tr('Escolher outras pastas…', 'Choose other folders…') : tr('Escolher outra pasta…', 'Choose another folder…')}
      </button>
      {distros.map((d) => (
        <button
          key={d}
          onClick={() => void pickOther(d)}
          className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-text"
        >
          <FolderOpen size={14} className="shrink-0" />
          {multiple
            ? tr(`Escolher pastas do Linux - WSL (${d})…`, `Choose Linux folders - WSL (${d})…`)
            : tr(`Escolher pasta do Linux - WSL (${d})…`, `Choose Linux folder - WSL (${d})…`)}
        </button>
      ))}
      {multiple && (
        <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-xs text-muted">
            {selected.length === 0
              ? tr('Nenhuma pasta marcada', 'No folders checked')
              : selected.length === 1
                ? tr('1 pasta marcada - marque mais uma', '1 folder checked - check one more')
                : tr(`${selected.length} pastas marcadas`, `${selected.length} folders checked`)}
          </span>
          <Button variant="primary" size="sm" disabled={selected.length < 2} onClick={create}>
            {tr('Criar espaço de trabalho', 'Create workspace')}
          </Button>
        </div>
      )}
    </Modal>
  )
}

// Uma pasta da lista: nome, pasta de cima, "no canvas" e há quanto tempo teve conversa.
const FolderRow = memo(function FolderRow({
  folder,
  index,
  highlighted,
  onCanvas,
  checked,
  onPick,
  onHighlight
}: {
  folder: KnownFolder
  index: number
  highlighted: boolean
  onCanvas: Set<string>
  // Workspace: marcada ou não (com caixinha no lugar do ícone). Sem ele, pasta avulsa.
  checked?: boolean
  onPick: (folder: string) => void
  onHighlight: (index: number) => void
}) {
  const path = displayPath(folder.path)
  const parent = parentDir(path) || path.slice(0, lastSep(path) + 1)
  return (
    <li>
      <button
        onClick={() => onPick(folder.path)}
        onMouseMove={() => onHighlight(index)}
        title={path}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
          highlighted ? 'bg-accent [&_span]:border-white/40 [&_span]:text-white [&_svg]:text-white' : ''
        }`}
      >
        {checked === undefined ? (
          <Folder size={14} className="shrink-0 text-muted" />
        ) : (
          <span
            role="checkbox"
            aria-checked={checked}
            className={`flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
              checked ? 'border-accent bg-accent' : 'border-line-strong'
            }`}
          >
            {checked && <Check size={10} strokeWidth={3} className="text-white" />}
          </span>
        )}
        <span className="shrink-0 font-medium text-text">{path.slice(lastSep(path) + 1)}</span>
        <span className="min-w-0 truncate text-faint">{parent}</span>
        {onCanvas.has(path) && (
          <span className="shrink-0 rounded-full border border-line px-1.5 text-[11px] text-faint">{tr('no canvas', 'on canvas')}</span>
        )}
        {folder.updatedAt && <TimeAgo iso={folder.updatedAt} className="pl-2" />}
      </button>
    </li>
  )
})
