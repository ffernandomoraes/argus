import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import type { ChatState } from '../../../../shared/chat'
import type { Message } from '../types'
import { isDelivered, type PendingSend } from './optimisticSends'

// Sem nenhum estado do chat depois do envio por este tempo, o envio não chegou ao Claude (o
// processo principal responde na hora: o "Trabalhando…" sai junto com o envio).
const DEADLINE_MS = 15_000
const NONE: PendingSend[] = []

export type OutgoingMessage = { text: string; typed: string; files: File[] }

// Balões provisórios das mensagens enviadas. Saem quando a mensagem chega ao histórico, quando o
// pedido termina (comando de barra não volta como mensagem sua), quando o envio falha (drop) ou
// quando passa o prazo sem resposta (onLost: o texto volta para o campo). `previewOpen`: o preview
// grande de imagem está aberto, talvez numa imagem de um balão que já saiu.
export function useOptimisticSends(
  messages: Message[],
  live: ChatState | null,
  previewOpen: boolean,
  onLost: (sends: PendingSend[]) => void
) {
  const [sent, setSent] = useState<PendingSend[]>(NONE)

  // Chegou no histórico: sai no mesmo desenho em que a mensagem aparece (sem os dois juntos). A
  // mensagem nova sempre muda o fim da lista; comparar pelo fim (e não pela lista em si) não entra
  // em laço se alguém passar uma lista nova a cada desenho.
  const tip = `${messages.length}|${messages.at(-1)?.id ?? ''}`
  const [seenTip, setSeenTip] = useState(tip)
  if (seenTip !== tip) {
    setSeenTip(tip)
    const left = sent.filter((s) => !isDelivered(s, messages))
    if (left.length !== sent.length) setSent(left.length ? left : NONE)
  }

  // Terminou o pedido: limpa o que sobrou.
  const active = live?.status === 'running' || live?.status === 'needs-you'
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) {
    setWasActive(active)
    if (wasActive && sent.length) setSent(NONE)
  }

  // Endereços das miniaturas de cada balão: liberados quando ele sai, e todos ao sair da conversa.
  // Com o preview aberto, esperam ele fechar: liberar no meio quebraria a imagem à vista.
  const owned = useRef(new Map<string, string[]>())
  useEffect(() => {
    if (previewOpen) return
    const ids = new Set(sent.map((s) => s.id))
    for (const [id, urls] of owned.current) {
      if (ids.has(id)) continue
      urls.forEach((u) => URL.revokeObjectURL(u))
      owned.current.delete(id)
    }
  }, [sent, previewOpen])
  useEffect(() => {
    const map = owned.current
    return () => {
      for (const urls of map.values()) urls.forEach((u) => URL.revokeObjectURL(u))
      map.clear()
    }
  }, [])

  // Prazo: confere na hora em que o envio mais antigo vence. Algum estado do chat chegou depois do
  // envio (outro objeto em `live`): o processo principal recebeu, e o balão segue esperando.
  const latestLive = useRef(live)
  useLayoutEffect(() => {
    latestLive.current = live
  })
  const expire = useEffectEvent((gone: PendingSend[]) => {
    setSent((all) => {
      const next = all.filter((s) => !gone.includes(s))
      return next.length ? next : NONE
    })
    onLost(gone)
  })
  useEffect(() => {
    if (!sent.length) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = (list: PendingSend[]) => {
      const due = Math.min(...list.map((s) => s.sentAt)) + DEADLINE_MS
      timer = setTimeout(() => check(list), Math.max(0, due - Date.now()))
    }
    const check = (list: PendingSend[]) => {
      const unanswered = list.filter((s) => latestLive.current === s.live)
      const now = Date.now()
      const gone = unanswered.filter((s) => now - s.sentAt >= DEADLINE_MS)
      if (gone.length) expire(gone)
      else if (unanswered.length) schedule(unanswered)
    }
    schedule(sent)
    return () => clearTimeout(timer)
  }, [sent])

  const add = (m: OutgoingMessage): string => {
    const id = crypto.randomUUID()
    const urls = m.files.filter((f) => f.type.startsWith('image/')).map((f) => URL.createObjectURL(f))
    owned.current.set(id, urls)
    const read = () => Promise.resolve(urls)
    const entry: PendingSend = { ...m, id, images: urls.length, read, sentAt: Date.now(), after: messages.at(-1)?.id, live }
    setSent((all) => [...all, entry])
    return id
  }

  const drop = (id: string) =>
    setSent((all) => {
      const next = all.filter((s) => s.id !== id)
      return next.length ? next : NONE
    })

  return { waiting: sent, add, drop }
}
