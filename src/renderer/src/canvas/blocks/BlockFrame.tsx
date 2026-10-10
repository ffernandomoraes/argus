import type { CSSProperties, ReactNode } from 'react'
import { NodeResizer } from '@xyflow/react'

// Fora do componente: o NodeResizer recebe sempre os mesmos objetos de estilo.
const RESIZER_LINE: CSSProperties = { borderColor: 'var(--color-line-strong)' }
const RESIZER_HANDLE: CSSProperties = { background: 'var(--color-muted)', border: 'none', width: 8, height: 8 }

// Caixa dos blocos que mudam de tamanho (terminal e conversa no canvas): puxadores nas bordas
// com o bloco selecionado e a borda na cor de destaque. `className` traz o fundo e o resto que
// for só do bloco; `style`, cores extras (as perguntas na cor do grupo).
export function BlockFrame({
  selected,
  minHeight,
  className,
  style,
  children
}: {
  selected: boolean
  minHeight: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={360}
        minHeight={minHeight}
        lineStyle={RESIZER_LINE}
        handleStyle={RESIZER_HANDLE}
      />
      <div
        className={`flex h-full flex-col overflow-hidden rounded-xl border shadow-lg shadow-black/30 ${className ?? ''}`}
        style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line)', ...style }}
      >
        {children}
      </div>
    </>
  )
}
