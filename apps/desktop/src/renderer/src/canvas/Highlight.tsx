import { Fragment, type ReactNode } from 'react'

// Sem acento e minúsculo, letra por letra: a posição de cada letra dobrada aponta para a original.
function foldMap(text: string): { folded: string; at: number[] } {
  let folded = ''
  const at: number[] = []
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    folded += f
    for (let k = 0; k < f.length; k++) at.push(i)
  }
  return { folded, at }
}

// Texto com o termo buscado marcado (sem diferença de acento nem maiúscula), todas as vezes.
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (!q) return <>{text}</>
  const { folded, at } = foldMap(text)
  const parts: ReactNode[] = []
  let last = 0
  for (let i = folded.indexOf(q); i >= 0; i = folded.indexOf(q, i + q.length)) {
    const start = at[i]
    const end = at[i + q.length - 1] + 1
    if (start < last) continue
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <mark key={start} className="rounded-sm bg-amber-400/35 px-px text-text">
        {text.slice(start, end)}
      </mark>
    )
    last = end
  }
  if (!parts.length) return <>{text}</>
  parts.push(text.slice(last))
  return <>{parts.map((p, i) => (typeof p === 'string' ? <Fragment key={`t${i}`}>{p}</Fragment> : p))}</>
}
