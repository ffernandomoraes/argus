import { useCallback, useEffect, type RefObject } from 'react'

// Distância do topo (em px do layout, sem o zoom) em que as mensagens anteriores começam a
// carregar: um pouco antes de chegar lá, para o loader quase nem aparecer.
const LOAD_AT = 600

export type OlderMessages = {
  // Há mensagens antes das que estão na tela.
  more: boolean
  loading: boolean
  load: () => void
}

// Carrega as mensagens anteriores ao rolar perto do topo. Quando elas entram em cima, quem você lia
// continua no lugar (a linha do tempo ancora no item da tela; ver useTimelineVirtualizer).
export function useOlderMessages(scrollerRef: RefObject<HTMLDivElement | null>, older: OlderMessages | undefined) {
  const check = useCallback(() => {
    const el = scrollerRef.current
    if (el && older?.more && !older.loading && el.scrollTop <= LOAD_AT) older.load()
  }, [scrollerRef, older])

  // O lote chegou e você continua perto do topo (ele era curto): já pede o próximo.
  const loading = !!older?.loading
  useEffect(() => {
    if (!loading) check()
  }, [loading, check])

  return { onScroll: check }
}
