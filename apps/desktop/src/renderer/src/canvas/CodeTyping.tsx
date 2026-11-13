// Linhas de código sendo escritas, uma depois da outra, no lugar do loader: a pasta tem
// conversa em andamento. A animação fica no index.css (code-typing).
const LINES = [
  { x: 2, y: 2.75, w: 8 },
  { x: 4.5, y: 5.75, w: 8.5 },
  { x: 4.5, y: 8.75, w: 5 },
  { x: 2, y: 11.75, w: 10 }
]

export function CodeTyping({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={label} className="code-typing">
      {LINES.map((l, i) => (
        <rect key={i} x={l.x} y={l.y} width={l.w} height={1.5} rx={0.75} fill="currentColor" style={{ animationDelay: `${i * 0.35}s` }} />
      ))}
    </svg>
  )
}
