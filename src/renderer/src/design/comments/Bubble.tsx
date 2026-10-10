import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { PageComment } from './types'

const TEXT = 'whitespace-pre-wrap break-words text-[13px] leading-snug'

// Balão de um comentário, preso ao ponto: a ponta embaixo à esquerda, como a nota do canvas. As
// medidas vêm em pixels da página; o balão desfaz a redução do quadro para manter o tamanho.
export function Bubble({
  n,
  comment,
  at,
  scale,
  editing,
  onEdit,
  onSave,
  onRemove
}: {
  n: number
  comment: PageComment
  at: [number, number]
  scale: number
  editing: boolean
  onEdit: () => void
  onSave: (note: string) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(comment.note)
  const field = useRef<HTMLTextAreaElement>(null)
  // Volta a editar: o campo começa com o que está salvo no balão.
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing !== wasEditing) {
    setWasEditing(editing)
    if (editing) setDraft(comment.note)
  }
  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(field.current.value.length, field.current.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  const save = () => (draft.trim() ? onSave(draft) : onRemove())

  return (
    <div
      className="pointer-events-auto absolute"
      style={{ left: at[0], top: at[1], transform: `translateY(-100%) scale(${1 / scale})`, transformOrigin: 'bottom left' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => !editing && onEdit()}
        className={`flex max-w-[260px] items-start gap-2 rounded-2xl rounded-bl-sm border px-2.5 py-1.5 shadow-lg shadow-black/30 ${
          editing ? 'min-w-[200px] border-accent' : 'cursor-pointer border-accent/50'
        }`}
        style={{ background: 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))' }}
      >
        <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
          {n}
        </span>
        {editing ? (
          <div className="grid min-w-0 flex-1">
            <span aria-hidden className={`invisible col-start-1 row-start-1 ${TEXT}`}>
              {(draft || 'O que mudar aqui?') + ' '}
            </span>
            <textarea
              ref={field}
              value={draft}
              rows={1}
              cols={1}
              placeholder="O que mudar aqui?"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter guarda; Shift, Ctrl ou ⌘ + Enter pulam linha. Esc guarda o que tiver (vazio sai).
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  if (e.ctrlKey || e.metaKey || e.shiftKey) document.execCommand('insertText', false, '\n')
                  else save()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  save()
                }
              }}
              onBlur={save}
              className={`col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent p-0 text-text outline-none placeholder:text-faint ${TEXT}`}
            />
          </div>
        ) : (
          <p className={`min-w-0 flex-1 text-text ${TEXT} line-clamp-3`}>{comment.note}</p>
        )}
        {editing && (
          <button
            aria-label="Apagar comentário"
            title="Apagar comentário"
            // Antes do blur do campo, que guardaria.
            onMouseDown={(e) => {
              e.preventDefault()
              onRemove()
            }}
            className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-md text-muted hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
