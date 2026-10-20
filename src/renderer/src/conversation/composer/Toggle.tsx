import type { ReactNode } from 'react'

// Opção liga/desliga dentro de um menu: só o nome e o interruptor à direita (sem explicação: quem
// liga já sabe o que é).
export function Toggle({
  label,
  checked,
  onChange,
  icon,
  tag
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: ReactNode
  // Selo depois do nome (ex.: ExperimentTag).
  tag?: ReactNode
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-fill"
    >
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-xs text-text">
          {icon}
          {label}
          {tag}
        </span>
      </span>
      <span
        className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-line-strong'
        }`}
      >
        <span className={`size-3 rounded-full bg-white shadow-sm shadow-black/30 transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}
