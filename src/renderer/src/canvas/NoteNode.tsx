import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useReactFlow, type NodeProps } from '@xyflow/react'
import { trackPointerDrag } from './blocks/pointerDrag'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useFocusWhenVisible } from './blocks/useFocusWhenVisible'
import { useCanvasActions } from './CanvasContext'
import { NOTE_MAX_WIDTH, NOTE_MIN_WIDTH } from './factory'
import type { NoteNode as NoteNodeType } from './types'
import { useIsRenaming } from './useCanvasView'

const TEXT = 'whitespace-pre-wrap break-words text-[13px] leading-snug'

// Nota no canvas, como o comentário do Figma: um balão com a ponta embaixo à esquerda, que
// nasce pequeno, alarga com o texto até NOTE_MAX_WIDTH e depois cresce para baixo. Puxando a
// borda direita, a largura passa a ser a escolhida; a altura continua seguindo o texto.
// Dois cliques editam; Enter, clicar fora ou Esc guarda.
function NoteNodeView({ id, data, selected }: NodeProps<NoteNodeType>) {
  const { startRename, finishNote, setNoteWidth } = useCanvasActions()
  const { getZoom } = useReactFlow()
  const editing = useIsRenaming(id)
  const bubble = useRef<HTMLDivElement>(null)
  // Largura durante o arraste do puxador; só vai para o nó ao soltar (um passo no ⌘Z).
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const color = data.color
  const width = dragWidth ?? data.width

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    // Largura de layout (sem o zoom), a mesma unidade do canvas.
    const startWidth = bubble.current?.offsetWidth ?? NOTE_MIN_WIDTH
    const zoom = getZoom()
    const widthAt = (dx: number) => Math.max(NOTE_MIN_WIDTH, Math.round(startWidth + dx / zoom))
    trackPointerDrag(e, {
      onMove: (dx) => setDragWidth(widthAt(dx)),
      onEnd: (dx) => {
        setDragWidth(null)
        if (widthAt(dx) !== startWidth) setNoteWidth(id, widthAt(dx))
      }
    })
  }

  return (
    <div
      ref={bubble}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startRename(id)
      }}
      // Selecionada, a borda fica tracejada (Delete apaga); escrevendo, contínua.
      className={`relative rounded-2xl rounded-bl-sm border px-3 py-2 shadow-lg shadow-black/25 ${
        selected && !editing ? 'border-dashed' : ''
      } ${width ? '' : 'w-max'}`}
      style={{
        ...(width ? { width } : { minWidth: NOTE_MIN_WIDTH, maxWidth: NOTE_MAX_WIDTH }),
        borderColor: selected || editing ? color : `color-mix(in srgb, ${color} 40%, transparent)`,
        background: `color-mix(in srgb, ${color} 16%, var(--color-surface))`
      }}
    >
      {editing ? (
        <NoteEditor text={data.text} onDone={(text) => finishNote(id, text)} />
      ) : data.text ? (
        <p className={`text-text ${TEXT}`}>{data.text}</p>
      ) : (
        <p className={`text-faint ${TEXT}`}>Nota vazia - dois cliques para escrever</p>
      )}

      {/* Puxador da largura: a borda direita, com a nota selecionada. */}
      {selected && !editing && (
        <div
          onPointerDown={startResize}
          onDoubleClick={(e) => e.stopPropagation()}
          className="nodrag absolute -right-1 top-0 bottom-0 w-2 cursor-ew-resize"
        />
      )}
    </div>
  )
}

export const NoteNode = memo(NoteNodeView, sameNodeProps)

// Cursor no fim do texto ao começar a escrever.
const caretAtEnd = (el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length)

// Campo da nota: só existe enquanto ela é editada, e começa sempre do texto guardado.
function NoteEditor({ text, onDone }: { text: string; onDone: (text: string) => void }) {
  const [draft, setDraft] = useState(text)
  const field = useRef<HTMLTextAreaElement>(null)
  // Nota recém-criada fica invisível até o React Flow medir o tamanho dela (ver useFocusWhenVisible).
  useFocusWhenVisible(field, caretAtEnd)

  return (
    // O texto escondido embaixo dá o tamanho; o campo ocupa a mesma célula e acompanha.
    <div className="grid">
      <span aria-hidden className={`invisible col-start-1 row-start-1 ${TEXT}`}>
        {(draft || 'Escreva a nota') + ' '}
      </span>
      {/* nodrag/nowheel: selecionar texto e rolar valem para a nota, não para o canvas. */}
      <textarea
        ref={field}
        value={draft}
        // rows/cols mínimos: o tamanho natural do campo não pode alargar o balão.
        rows={1}
        cols={1}
        placeholder="Escreva a nota"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Compondo um acento ou um ideograma (IME), Enter e Esc são da composição.
          if (e.nativeEvent.isComposing) return
          // Enter guarda; Ctrl, ⌘ ou Shift + Enter pulam linha.
          if (e.key === 'Enter') {
            e.preventDefault()
            // Pelo execCommand, a quebra entra no desfazer do campo (⌘Z) como texto digitado.
            if (e.ctrlKey || e.metaKey || e.shiftKey) document.execCommand('insertText', false, '\n')
            else e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            // Só sai da edição; não fecha o que estiver aberto.
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        onBlur={(e) => onDone(e.currentTarget.value)}
        className={`nodrag nowheel nopan col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent p-0 text-text outline-none placeholder:text-faint ${TEXT}`}
      />
    </div>
  )
}
