// Anel pequeno com a porcentagem da janela de contexto ocupada pela conversa.
function ringColor(percent: number): string {
  if (percent >= 90) return '#ef4444'
  if (percent >= 75) return 'var(--color-needs-you)'
  return 'var(--color-muted)'
}

export function ContextRing({ percent }: { percent: number }) {
  const r = 5
  const circumference = 2 * Math.PI * r
  const value = Math.min(100, Math.max(0, percent))

  return (
    <span title={`Contexto: ${Math.round(value)}% usado`} className="flex shrink-0 items-center gap-1">
      <svg width="12" height="12" viewBox="0 0 12 12" className="-rotate-90">
        <circle cx="6" cy="6" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="2" />
        <circle
          cx="6"
          cy="6"
          r={r}
          fill="none"
          stroke={ringColor(value)}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span className="font-mono text-[10px] text-faint">{Math.round(value)}%</span>
    </span>
  )
}
