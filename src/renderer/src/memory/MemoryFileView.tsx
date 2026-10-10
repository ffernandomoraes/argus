import { Pencil } from 'lucide-react'
import type { MemoryFile } from '../../../shared/memory'
import { FileLinkContext } from '../conversation/fileLinks'
import { Markdown } from '../conversation/Markdown'
import { keys, tildify } from '../platform'
import { Button } from '../ui/Button'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { fileLabel, linkMemories, splitFrontmatter, TYPE_LABEL } from './memoryText'

// Lado direito da Memória: o arquivo escolhido, lido como Markdown ou editado como texto.
export function MemoryFileView({
  current,
  text,
  draft,
  error,
  dirty,
  onEdit,
  onCancel,
  onDraftChange,
  onSave,
  onOpenLink
}: {
  current: MemoryFile | null
  // Nulo enquanto o texto do arquivo não chega.
  text: string | null
  // Texto em edição; nulo fora da edição.
  draft: string | null
  error: string | null
  dirty: boolean
  onEdit: () => void
  onCancel: () => void
  onDraftChange: (text: string) => void
  onSave: () => void
  // Link entre anotações ([[nome]] ou arquivo.md) clicado no texto.
  onOpenLink: (target: string) => void
}) {
  const editing = draft !== null
  const meta = current?.kind === 'memory' ? current : null

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{current ? fileLabel(current) : ''}</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-faint">{current ? tildify(current.path) : ''}</div>
        </div>
        {current && !editing && (
          <Button size="sm" onClick={onEdit}>
            <Pencil size={12} />
            {current.exists ? 'Editar' : 'Criar'}
          </Button>
        )}
        {editing && (
          <>
            <Button size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={onSave} disabled={!dirty} title={`Salvar (${keys('⌘S')})`}>
              Salvar
            </Button>
          </>
        )}
        <ModalCloseButton />
      </header>

      {error && <p className="border-b border-line px-5 py-2 text-xs text-red-400">{error}</p>}

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-bg px-5 py-4 font-mono text-[13px] leading-relaxed text-text outline-none"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 select-text">
          {current && !current.exists && (
            <p className="text-xs text-faint">
              Este arquivo ainda não existe. Use <b>Criar</b> para escrever instruções que o Claude vai seguir nesta
              {current.path.includes('/.claude/CLAUDE.md') && !current.path.includes('/projects/') ? ' máquina inteira.' : ' pasta.'}
            </p>
          )}
          {meta && (meta.description || meta.type) && (
            <div className="mb-4 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs">
              {meta.type && (
                <span className="mr-2 rounded bg-bg px-1.5 py-0.5 text-[11px] text-muted">{TYPE_LABEL[meta.type] ?? meta.type}</span>
              )}
              <span className="text-muted">{meta.description}</span>
            </div>
          )}
          {current?.exists && text !== null && (
            <FileLinkContext.Provider value={onOpenLink}>
              <div className="text-sm leading-relaxed text-text">
                <Markdown text={linkMemories(splitFrontmatter(text))} />
              </div>
            </FileLinkContext.Provider>
          )}
        </div>
      )}
    </section>
  )
}
