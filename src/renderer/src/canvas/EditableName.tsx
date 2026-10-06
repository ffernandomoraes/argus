import { useRef } from 'react'
import { useCanvasActions } from './CanvasContext'

// Mostra o nome; vira campo de texto quando o nó está sendo renomeado.
export function EditableName({ id, value, className }: { id: string; value: string; className?: string }) {
  const { renamingId, finishRename } = useCanvasActions()
  const cancelled = useRef(false)

  if (renamingId !== id) return <span className={`truncate ${className ?? ''}`}>{value}</span>

  return (
    <input
      autoFocus
      defaultValue={value}
      onFocus={(e) => {
        cancelled.current = false
        e.target.select()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => finishRename(id, cancelled.current ? null : e.currentTarget.value)}
      className={`nodrag nopan min-w-0 flex-1 rounded border border-line-strong bg-bg px-1 outline-none ${className ?? ''}`}
    />
  )
}
