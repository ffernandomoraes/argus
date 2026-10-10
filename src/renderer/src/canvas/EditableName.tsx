import { useRef } from 'react'
import { useFocusWhenVisible } from './blocks/useFocusWhenVisible'
import { useCanvasActions } from './CanvasContext'
import { useIsRenaming } from './useCanvasView'

// Mostra o nome; vira campo de texto quando o nó está sendo renomeado.
export function EditableName({ id, value, className }: { id: string; value: string; className?: string }) {
  const { finishRename } = useCanvasActions()
  // Só o bloco que entra ou sai da renomeação redesenha.
  const renaming = useIsRenaming(id)
  if (!renaming) return <span className={`truncate ${className ?? ''}`}>{value}</span>
  return <NameField id={id} value={value} className={className} onDone={finishRename} />
}

// O campo só existe durante a renomeação: ao aparecer, pega o foco com o texto selecionado.
// Enter guarda; Esc cancela; clicar fora guarda.
function NameField({
  id,
  value,
  className,
  onDone
}: {
  id: string
  value: string
  className?: string
  onDone: (id: string, value: string | null) => void
}) {
  const cancelled = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  useFocusWhenVisible(input)

  return (
    <input
      ref={input}
      defaultValue={value}
      onFocus={(e) => {
        cancelled.current = false
        e.target.select()
      }}
      onKeyDown={(e) => {
        // Compondo um acento ou um ideograma (IME), Enter e Esc são da composição.
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          // Só cancela a renomeação; não fecha o que estiver aberto.
          e.preventDefault()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
      onBlur={(e) => onDone(id, cancelled.current ? null : e.currentTarget.value)}
      className={`nodrag nopan min-w-0 flex-1 rounded border border-line-strong bg-bg px-1 outline-none ${className ?? ''}`}
    />
  )
}
