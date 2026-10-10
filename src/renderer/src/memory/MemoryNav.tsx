import { useState } from 'react'
import { Brain, ChevronRight, FileText, Globe, ListTree } from 'lucide-react'
import type { MemoryGroup } from '../../../shared/memory'
import { tildify } from '../platform'
import { fileLabel } from './memoryText'

// Lista da esquerda: os arquivos de memória por pasta (o global primeiro).
export function MemoryNav({
  groups,
  only,
  selected,
  onSelect
}: {
  groups: MemoryGroup[]
  // Uma pasta só: o nome dela vai no título e não há grupos para abrir e fechar.
  only?: string
  selected: string | null
  onSelect: (path: string) => void
}) {
  // Grupos abertos (id do grupo): começa só com o global, projetos recolhidos.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['global']))
  const toggleGroup = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <nav className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-2/40 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 pt-1 text-sm font-semibold">
        <Brain size={15} />
        <span className="truncate">{only ? `Memória - ${groups[0]?.label ?? ''}` : 'Memória'}</span>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="mb-3">
          {/* Com uma pasta só, o nome dela já está no título. */}
          {!only && (
            <button
              onClick={() => toggleGroup(g.id)}
              aria-expanded={expanded.has(g.id)}
              className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-left text-[12px] font-medium uppercase tracking-wide text-faint hover:text-muted"
            >
              <ChevronRight size={11} className={`shrink-0 transition-transform ${expanded.has(g.id) ? 'rotate-90' : ''}`} />
              {g.id === 'global' && <Globe size={11} className="shrink-0" />}
              <span className="truncate">{g.label}</span>
            </button>
          )}
          {(only || expanded.has(g.id)) &&
            g.files.map((f) => (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                title={f.description ?? tildify(f.path)}
                aria-current={selected === f.path ? 'page' : undefined}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                  selected === f.path
                    ? 'bg-selection text-white [&_.text-faint]:text-white/70 [&_.text-muted]:text-white/80'
                    : 'text-muted hover:bg-fill hover:text-text'
                } ${f.kind === 'memory' ? 'pl-5' : ''}`}
              >
                {f.kind === 'index' ? <ListTree size={13} className="shrink-0" /> : <FileText size={13} className="shrink-0" />}
                <span className={`truncate ${f.exists ? '' : 'italic text-faint'}`}>{fileLabel(f)}</span>
                {!f.exists && <span className="ml-auto shrink-0 text-[11px] text-faint">criar</span>}
              </button>
            ))}
        </div>
      ))}
    </nav>
  )
}
