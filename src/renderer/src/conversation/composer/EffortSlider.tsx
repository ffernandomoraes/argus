import { EFFORTS, effortLabel, MAX_WARNING } from '../modelOptions'

type Effort = (typeof EFFORTS)[number]

// Régua do esforço no menu do modelo: uma marca por nível que o modelo aceita. Clicar na marca
// atual volta para Auto.
export function EffortSlider({
  allowed,
  value,
  onChange
}: {
  allowed: Effort[]
  value: string
  onChange: (effort: string) => void
}) {
  const index = allowed.findIndex((e) => e.value === value)
  return (
    <div className="px-2 pb-2 pt-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-faint">Esforço</span>
        <span className="text-text">{effortLabel(value)}</span>
      </div>
      <div className="relative mt-2.5 flex h-4 items-center justify-between">
        <div className="absolute inset-x-1.5 h-0.5 rounded-full bg-line" />
        <div
          className="absolute left-1.5 h-0.5 rounded-full bg-muted"
          style={{ width: `calc((100% - 12px) * ${Math.max(0, index) / Math.max(1, allowed.length - 1)})` }}
        />
        {allowed.map((e, i) => (
          <button
            key={e.value}
            aria-label={e.label}
            title={e.label}
            onClick={() => onChange(value === e.value ? '' : e.value)}
            className={`relative size-3 rounded-full border-2 ${
              i <= index ? 'border-text bg-text' : 'border-line-strong bg-surface hover:border-muted'
            }`}
          />
        ))}
      </div>
      {value === 'max' && <p className="mt-2 text-[12px] leading-snug text-needs-you">{MAX_WARNING}</p>}
    </div>
  )
}

// Bolinhas do esforço no botão do seletor: quantas acesas, de cinco.
export function EffortDots({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {EFFORTS.map((_, i) => (
        <span key={i} className={`size-[5px] rounded-full bg-current ${i < level ? '' : 'opacity-20'}`} />
      ))}
    </span>
  )
}
