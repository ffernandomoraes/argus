import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useReactFlow, type NodeProps } from '@xyflow/react'
import { useCanvasActions } from './CanvasContext'
import { NOTE_MAX_WIDTH, NOTE_MIN_WIDTH } from './factory'
import type { NoteNode as NoteNodeType } from './types'

const TEXT = 'whitespace-pre-wrap break-words text-[13px] leading-snug'

// Nota no canvas, como o comentário do Figma: um balão com a ponta embaixo à esquerda, que
// nasce pequeno, alarga com o texto até NOTE_MAX_WIDTH e depois cresce para baixo. Puxando a
// borda direita, a largura passa a ser a escolhida; a altura continua seguindo o texto.
// Dois cliques editam; Enter, clicar fora ou Esc guarda.
export function NoteNode({ id, data, selected }: NodeProps<NoteNodeType>) {
  const { renamingId, startRename, finishNote, setNoteWidth } = useCanvasActions()
  const { getZoom } = useReactFlow()
  const editing = renamingId === id
  const field = useRef<HTMLTextAreaElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(data.text)
  // Largura durante o arraste do puxador; só vai para o nó ao soltar (um passo no ⌘Z).
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const color = data.color
  const width = dragWidth ?? data.width

  useEffect(() => {
    if (editing) setDraft(data.text)
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nota recém-criada fica invisível até o React Flow medir o tamanho dela, e o navegador não
  // foca elemento invisível. Tenta a cada quadro até pegar (como no EditableName).
  useEffect(() => {
    if (!editing) return
    let frame = 0
    let tries = 0
    const focus = () => {
      const el = field.current
      if (!el || document.activeElement === el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      if (document.activeElement !== el && ++tries < 30) frame = requestAnimationFrame(focus)
    }
    focus()
    return () => cancelAnimationFrame(frame)
  }, [editing])

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    // Largura de layout (sem o zoom), a mesma unidade do canvas.
    const startWidth = bubble.current?.offsetWidth ?? NOTE_MIN_WIDTH
    const zoom = getZoom()
    let last = startWidth
    const move = (ev: PointerEvent) => {
      last = Math.max(NOTE_MIN_WIDTH, Math.round(startWidth + (ev.clientX - startX) / zoom))
      setDragWidth(last)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      setDragWidth(null)
      if (last !== startWidth) setNoteWidth(id, last)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
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
              // Enter guarda; Ctrl, ⌘ ou Shift + Enter pulam linha.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
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
            onBlur={(e) => finishNote(id, e.currentTarget.value)}
            className={`nodrag nowheel nopan col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent p-0 text-text outline-none placeholder:text-faint ${TEXT}`}
          />
        </div>
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
