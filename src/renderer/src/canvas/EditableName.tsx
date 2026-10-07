import { useEffect, useRef } from 'react'
import { useCanvasActions } from './CanvasContext'

// Mostra o nome; vira campo de texto quando o nó está sendo renomeado.
export function EditableName({ id, value, className }: { id: string; value: string; className?: string }) {
  const { renamingId, finishRename } = useCanvasActions()
  const cancelled = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const editing = renamingId === id

  // Bloco recém-criado fica invisível até o React Flow medir o tamanho dele, e o
  // navegador não foca elemento invisível (o autoFocus falha). Tenta a cada quadro até pegar.
  useEffect(() => {
    if (!editing) return
    let frame = 0
    let tries = 0
    const focus = () => {
      const el = input.current
      if (!el || document.activeElement === el) return
      el.focus()
      if (document.activeElement !== el && ++tries < 30) frame = requestAnimationFrame(focus)
    }
    focus()
    return () => cancelAnimationFrame(frame)
  }, [editing])

  if (renamingId !== id) return <span className={`truncate ${className ?? ''}`}>{value}</span>

  return (
    <input
      ref={input}
      defaultValue={value}
      onFocus={(e) => {
        cancelled.current = false
        e.target.select()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          // Só cancela a renomeação; não fecha o que estiver aberto.
          e.preventDefault()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => finishRename(id, cancelled.current ? null : e.currentTarget.value)}
      className={`nodrag nopan min-w-0 flex-1 rounded border border-line-strong bg-bg px-1 outline-none ${className ?? ''}`}
    />
  )
}
