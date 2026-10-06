import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Linha de configuração: rótulo e explicação à esquerda, controle à direita.
export function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-4 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-text">{label}</div>
        {description && <div className="mt-0.5 text-xs leading-relaxed text-faint">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs ${
            value === o.value ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({
  value,
  onChange,
  children
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="relative flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-44 cursor-pointer appearance-none rounded-md border border-line bg-bg py-1.5 pl-2.5 pr-7 text-xs text-text outline-none hover:border-line-strong"
      >
        {children}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 text-faint" />
    </label>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-text' : 'bg-line-strong'}`}
    >
      <span className={`size-4 rounded-full bg-surface transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}
