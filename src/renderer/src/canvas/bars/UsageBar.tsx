import { barColor } from './usageFormat'

// Barrinha de uso: cinza, âmbar a partir de 75% e vermelha a partir de 90%.
export function UsageBar({ percent, className }: { percent: number; className: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${barColor(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  )
}
