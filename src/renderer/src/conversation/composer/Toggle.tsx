import type { ReactNode } from 'react'

// Opção liga/desliga dentro de um menu: nome, explicação curta e o interruptor à direita.
export function Toggle({
  label,
  description,
  checked,
  onChange,
  icon
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: ReactNode
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-fill"
    >
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-xs text-text">
          {icon}
          {label}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-faint">{description}</span>
      </span>
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-line-strong'
        }`}
      >
        <span className={`size-3 rounded-full bg-white shadow-sm shadow-black/30 transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}
