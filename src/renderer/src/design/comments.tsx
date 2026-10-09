import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

// Comentário na página do protótipo: o ponto clicado (preso a um elemento da página, ver COMMENT
// em designPicker.ts), o que se sabe desse elemento e o pedido escrito no balão. Vários se juntam
// e vão num pedido só; enviados, somem.
export type PageComment = {
  id: number
  note: string
  // A página em que foi feito.
  route: string
  name: string
  text: string
  html: string
  path: string
  source: string
  // Ponto do clique, em pixels da página; a posição atual vem de `pos`.
  x: number
  y: number
}

// Posição atual de cada ponto (x, y, à vista); nula quando o elemento saiu da página.
export type CommentPositions = Record<number, [number, number, boolean] | null>

const TEXT = 'whitespace-pre-wrap break-words text-[13px] leading-snug'

// O pedido para o Claude: o texto que aparece no chat (curto) e o contexto de cada ponto (no hint).
export function commentsText(comments: PageComment[]): string {
  const lines = comments.map((c, i) => `${i + 1}. ${c.note.trim()} (em ${c.name}${c.text ? ` "${c.text.slice(0, 60)}"` : ''})`)
  return `Comentários na página ${comments[0]?.route ?? '/'}:\n${lines.join('\n')}`
}

export function commentsHint(comments: PageComment[]): string {
  const items = comments.map((c, i) =>
    [
      `Comentário ${i + 1}: "${c.note.trim()}"`,
      `- Onde: ${c.name}${c.text ? ` com o texto "${c.text}"` : ''}, na página ${c.route}.`,
      c.path ? `- Caminho na página: ${c.path}` : '',
      c.source ? `- Pistas do código (modo de desenvolvimento do framework): ${c.source}` : '',
      `- HTML como está na página (já renderizado, não é o código-fonte):\n${c.html}`
    ]
      .filter(Boolean)
      .join('\n')
  )
  return `<modo-design>
A pessoa deixou comentários em pontos da página, como no Figma. Cada um é um pedido sobre o elemento clicado e o que está perto dele: ache no código o componente de cada ponto e faça o que o comentário pede ali, sem mexer no resto. Atenda todos e, no fim, diga em uma linha o que fez em cada número.

${items.join('\n\n')}
</modo-design>`
}

// Balão de um comentário, preso ao ponto: a ponta embaixo à esquerda, como a nota do canvas. As
// medidas vêm em pixels da página; o balão desfaz a redução do quadro para manter o tamanho.
function Bubble({
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
  useEffect(() => {
    if (!editing) return
    setDraft(comment.note)
    const frame = requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(field.current.value.length, field.current.value.length)
    })
    return () => cancelAnimationFrame(frame)
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

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
            className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded text-muted hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// Camada dos balões por cima da página, no mesmo tamanho e redução do quadro dela.
export function CommentLayer({
  comments,
  route,
  pos,
  scale,
  editing,
  onEdit,
  onSave,
  onRemove
}: {
  comments: PageComment[]
  // Só os balões da página aberta; a numeração é a de todos, a mesma do pedido.
  route: string
  pos: CommentPositions
  scale: number
  editing: number | null
  onEdit: (id: number) => void
  onSave: (id: number, note: string) => void
  onRemove: (id: number) => void
}) {
  return (
    <>
      {comments.map((c, i) => {
        if (c.route !== route) return null
        const p = pos[c.id]
        // Elemento que saiu da página ou rolou para fora: o balão some (o em edição fica).
        if (p === null || (p && !p[2] && editing !== c.id)) return null
        return (
          <Bubble
            key={c.id}
            n={i + 1}
            comment={c}
            at={p ? [p[0], p[1]] : [c.x, c.y]}
            scale={scale}
            editing={editing === c.id}
            onEdit={() => onEdit(c.id)}
            onSave={(note) => onSave(c.id, note)}
            onRemove={() => onRemove(c.id)}
          />
        )
      })}
    </>
  )
}
