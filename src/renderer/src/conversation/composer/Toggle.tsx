import type { ReactNode } from 'react'

// Opção liga/desliga dentro de um menu: só o nome e o interruptor à direita (sem explicação: quem
// liga já sabe o que é). note: aviso embaixo do nome, quando a opção não vale aqui.
export function Toggle({
  label,
  checked,
  onChange,
  icon,
  tag,
  disabled,
  note
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon?: ReactNode
  // Selo depois do nome (ex.: ExperimentTag).
  tag?: ReactNode
  disabled?: boolean
  note?: ReactNode
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left enabled:hover:bg-fill disabled:cursor-default"
    >
      <span className="flex-1">
        <span className={`flex items-center gap-1.5 text-xs text-text ${disabled ? 'opacity-50' : ''}`}>
          {icon}
          {label}
          {tag}
        </span>
        {note && <span className="mt-1 block text-xs leading-snug text-muted">{note}</span>}
      </span>
      <span
        className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-line-strong'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <span className={`size-3 rounded-full bg-white shadow-sm shadow-black/30 transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  )
}
