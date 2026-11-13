import type { ReactNode } from 'react'

// Campo de texto do agente (nome, quando usar, instruções, outras ferramentas).
export const INPUT =
  'rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-text outline-none placeholder:text-faint focus:border-line-strong'

// Rótulo em cima, o campo e a explicação embaixo.
export function Field({
  label,
  hint,
  className = '',
  children
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-text">{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
    </label>
  )
}
