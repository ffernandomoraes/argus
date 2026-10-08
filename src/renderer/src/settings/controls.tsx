import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Botão com borda das configurações, em cápsula como os do macOS.
export const BUTTON = 'whitespace-nowrap rounded-full border border-line bg-fill px-3 py-1 text-xs'

// Ícone num quadradinho colorido, como os do Ajustes do Sistema. `color` é o fundo; o ícone é branco.
// `soft`: versão discreta, com o fundo só tingido da cor e o ícone na própria cor.
export function IconTile({
  color,
  size = 20,
  soft,
  children
}: {
  color: string
  size?: number
  soft?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${soft ? '' : 'text-white shadow-sm shadow-black/20'}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        ...(soft
          ? { color, background: `color-mix(in srgb, ${color} 16%, transparent)` }
          : { background: `linear-gradient(180deg, color-mix(in srgb, ${color} 82%, white), ${color})` })
      }}
    >
      {children}
    </span>
  )
}

// Lista agrupada: as linhas (Row) num cartão arredondado, separadas por uma linha fina.
export function Group({ children }: { children: ReactNode }) {
  return <div className="mb-4 rounded-xl bg-fill px-4 last:mb-0">{children}</div>
}

// Linha de configuração: rótulo e explicação à esquerda, controle à direita.
export function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] text-text">{label}</div>
        {description && <div className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</div>}
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
    <div className="flex rounded-full bg-fill p-0.5 ring-1 ring-line ring-inset">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] ${
            value === o.value ? 'bg-control text-text shadow-sm shadow-black/20' : 'text-muted hover:text-text'
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
        className="min-w-44 cursor-pointer appearance-none rounded-md border border-line bg-fill py-1 pl-2.5 pr-8 text-[12px] text-text outline-none hover:border-line-strong"
      >
        {children}
      </select>
      {/* A setinha num quadradinho na cor de destaque, como o menu suspenso do macOS. */}
      <span className="pointer-events-none absolute right-1 flex size-4 items-center justify-center rounded bg-accent text-white">
        <ChevronDown size={11} strokeWidth={2.5} />
      </span>
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
      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-accent' : 'bg-line-strong'}`}
    >
      <span className={`size-4 rounded-full bg-white shadow-sm shadow-black/30 transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}
