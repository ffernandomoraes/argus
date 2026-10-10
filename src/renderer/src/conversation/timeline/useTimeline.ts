import { useMemo } from 'react'
import { turnFooters } from '../turnInfo'
import { historyItems } from './historyItems'
import { liveItems, type LiveOptions } from './liveItems'
import type { TimelineItem } from './timelineItem'

type Options = LiveOptions & {
  running: boolean
  compact: boolean
  // Há quem leia as imagens das mensagens gravadas.
  readsImages: boolean
}

// Itens da linha do tempo. O histórico só é remontado quando as mensagens mudam: o texto chegando
// aos poucos refaz apenas a parte ao vivo, e a lista é a mesma enquanto nada muda.
export function useTimeline({ messages, waiting, live, status, clean, viewFor, onAnswer, running, compact, readsImages }: Options) {
  const footers = useMemo(() => turnFooters(messages, running), [messages, running])
  const history = useMemo(
    () => historyItems(messages, { footers, running, compact, clean, viewFor: readsImages ? viewFor : undefined }),
    [messages, footers, running, compact, clean, viewFor, readsImages]
  )
  const tail = useMemo(
    () => liveItems({ messages, waiting, live, status, clean, viewFor, onAnswer }),
    [messages, waiting, live, status, clean, viewFor, onAnswer]
  )
  return useMemo<TimelineItem[]>(() => (tail.length ? [...history, ...tail] : history), [history, tail])
}
