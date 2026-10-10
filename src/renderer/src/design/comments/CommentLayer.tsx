import { useState, type RefObject } from 'react'
import { pathOnly } from '../address/routeText'
import { usePageMessages } from '../page/usePageMessages'
import { Bubble } from './Bubble'
import type { CommentPositions, PageComment } from './types'

const NONE: CommentPositions = {}

// Camada dos balões por cima da página, no mesmo tamanho e redução do quadro dela. A posição de
// cada ponto chega da página a cada rolagem e fica aqui, e não no painel: a página rolando não
// redesenha a conversa ao lado.
export function CommentLayer({
  comments,
  route,
  scale,
  loads,
  frameRef,
  origin,
  editing,
  onEdit,
  onSave,
  onRemove
}: {
  comments: PageComment[]
  // Só os balões da página aberta; a numeração é a de todos, a mesma do pedido.
  route: string
  scale: number
  // Cargas da página no quadro: cada carga nova começa sem posições (as da anterior não valem).
  loads: number
  frameRef: RefObject<HTMLIFrameElement | null>
  origin: string | null
  editing: number | null
  onEdit: (id: number) => void
  onSave: (id: number, note: string) => void
  onRemove: (id: number) => void
}) {
  const [reported, setReported] = useState<{ loads: number; pos: CommentPositions }>({ loads, pos: NONE })
  usePageMessages(frameRef, origin, (m) => {
    if (m.kind === 'comment-pos') setReported({ loads, pos: m.pos })
  })
  const pos = reported.loads === loads ? reported.pos : NONE
  // Busca e âncora não mudam a página: o balão continua nela.
  const page = pathOnly(route)

  return (
    <>
      {comments.map((c, i) => {
        if (pathOnly(c.route) !== page) return null
        const p = pos[c.id]
        // Elemento que saiu da página ou rolou para fora: o balão some (o em edição fica).
        if (p === null || (p && !p[2] && editing !== c.id)) return null
        return (
          <Bubble
            key={c.id}
            n={i + 1}
            comment={c}
            at={p ? [p[0], p[1]] : [c.x, c.y]}
            scale={scale}
            editing={editing === c.id}
            onEdit={() => onEdit(c.id)}
            onSave={(note) => onSave(c.id, note)}
            onRemove={() => onRemove(c.id)}
          />
        )
      })}
    </>
  )
}
