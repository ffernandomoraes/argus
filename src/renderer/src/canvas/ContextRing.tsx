// Anel pequeno com a porcentagem da janela de contexto ocupada pela conversa.
// A cor vai de um vermelho apagado (pouco contexto) a um vermelho forte (cheio), para avisar
// que encher a janela atrapalha. O apagado sai da mistura com a cor do trilho: no tema claro
// fica rosado e escurece até o fim; no escuro, um vermelho escuro de verdade sumiria no fundo.
function ringColor(percent: number): string {
  const strength = 30 + (percent / 100) * 70
  return `color-mix(in oklab, #dc2626 ${strength}%, var(--color-line-strong))`
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
      <span className="font-mono text-[11px] text-faint">{Math.round(value)}%</span>
    </span>
  )
}
