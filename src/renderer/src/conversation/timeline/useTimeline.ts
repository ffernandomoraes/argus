import { useMemo, useState } from 'react'
import { turnFooters } from '../turnInfo'
import { historyItems } from './historyItems'
import { liveItems, type LiveOptions } from './liveItems'
import { createPreviewKeys } from './previewKeys'
import type { TimelineItem } from './timelineItem'

type Options = LiveOptions & {
  running: boolean
  // Há quem leia as imagens das mensagens gravadas.
  readsImages: boolean
  // Reenviar uma mensagem sua editada (ver UserBubble). Função fixa: uma nova refaz o histórico.
  onEdit?: (text: string) => void
}

// Itens da linha do tempo. O histórico só é remontado quando as mensagens mudam: o texto chegando
// aos poucos refaz apenas a parte ao vivo, e a lista é a mesma enquanto nada muda.
export function useTimeline({ messages, waiting, live, status, viewFor, onAnswer, onResend, running, readsImages, onEdit }: Options) {
  // A resposta gravada fica com a chave da prévia que estava na tela (ver previewKeys). Antes de
  // montar o histórico: é na leitura que traz a resposta que ela herda a chave.
  const [previews] = useState(createPreviewKeys)
  previews.update(live, messages)
  const previewKey = previews.current()
  const footers = useMemo(() => turnFooters(messages, running), [messages, running])
  const history = useMemo(
    () =>
      historyItems(messages, {
        footers,
        running,
        viewFor: readsImages ? viewFor : undefined,
        viewFile: viewFor,
        onEdit,
        answerKey: previews.keyOf
      }),
    [messages, footers, running, viewFor, readsImages, onEdit, previews]
  )
  const tail = useMemo(
    () => liveItems({ messages, waiting, live, status, viewFor, onAnswer, onResend, previewKey }),
    [messages, waiting, live, status, viewFor, onAnswer, onResend, previewKey]
  )
  return useMemo<TimelineItem[]>(() => (tail.length ? [...history, ...tail] : history), [history, tail])
}
