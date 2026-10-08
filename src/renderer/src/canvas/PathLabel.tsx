import { lastSep } from '../platform'

// Caminho com o começo cortável e a pasta final sempre visível:
// ~/Desktop/proj…/canva-agent-editor. O corte acompanha o espaço disponível.
export function PathLabel({ path, className }: { path: string; className?: string }) {
  const cut = lastSep(path)
  const head = cut >= 0 ? path.slice(0, cut + 1) : ''
  const tail = cut >= 0 ? path.slice(cut + 1) : path

  return (
    <span title={path} className={`flex min-w-0 font-mono ${className ?? ''}`}>
      <span className="truncate">{head}</span>
      <span className="shrink-0">{tail}</span>
    </span>
  )
}
