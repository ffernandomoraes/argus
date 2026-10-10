import { useState } from 'react'
import type { DesignCommentAction } from '../../../../shared/ipc'
import type { NewComment, PageComment } from './types'

// Comentários na página do protótipo: ligado, cada clique na página marca um ponto e abre um balão
// para escrever o que mudar ali. Vários se juntam e vão no próximo envio do chat; depois, somem.
// `origin`: a página aberta (os pontos ficam nela). `here`: o endereço em que a pessoa está.
export function useComments(origin: string | null, here: string | undefined) {
  const [commenting, setCommenting] = useState(false)
  const [comments, setComments] = useState<PageComment[]>([])
  const [editing, setEditing] = useState<number | null>(null)

  const inPage = (action: DesignCommentAction, id?: number) => {
    if (origin) window.api.design.comment(origin, action, id)
  }

  const stop = () => {
    if (!commenting) return
    setCommenting(false)
    inPage('off')
  }

  const toggle = () => {
    if (commenting) return stop()
    setCommenting(true)
    inPage('on')
  }

  // Ponto novo marcado na página. Só com o modo comentar ligado (uma mensagem da página fora dele
  // não vira comentário) e uma vez por id (recarregada, a página podia repetir um).
  const add = (c: NewComment) => {
    if (!commenting || comments.some((x) => x.id === c.id)) return
    // Balão vazio que não está em edição sai ao marcar outro ponto.
    setComments((all) => [...all.filter((x) => x.note.trim() || x.id === editing), { ...c, note: '', route: here ?? '/' }])
    setEditing(c.id)
  }

  const remove = (id: number) => {
    setComments((all) => all.filter((c) => c.id !== id))
    setEditing((e) => (e === id ? null : e))
    inPage('remove', id)
  }

  const save = (id: number, note: string) => {
    setComments((all) => all.map((c) => (c.id === id ? { ...c, note } : c)))
    setEditing((e) => (e === id ? null : e))
  }

  // Descarta todos (e desliga o modo comentar): depois do envio ou pelo X do chip.
  const discard = () => {
    setComments([])
    setEditing(null)
    inPage('clear')
    stop()
  }

  // Página recarregada: o script dela é novo, e o modo comentar, se estava ligado, liga de novo.
  const resume = () => {
    if (commenting) inPage('on')
  }

  // Os escritos: são os que vão junto do pedido.
  const ready = comments.filter((c) => c.note.trim())

  return { commenting, comments, ready, editing, setEditing, toggle, stop, add, remove, save, discard, resume }
}
