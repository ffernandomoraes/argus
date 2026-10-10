import { useState } from 'react'
import { useServerPolls } from '../../devServers/projectServers'
import { nextPagePort, NO_PAGE_PORT, type PagePort, type PortInput } from './pagePort'

// A porta da página do protótipo (ver pagePort.ts), decidida a cada render a partir do servidor.
export function usePagePort(input: Omit<PortInput, 'poll'>): number | null {
  const [pick, setPick] = useState<PagePort>(NO_PAGE_PORT)
  // Só acompanha as consultas enquanto a porta da página está faltando na lista.
  const poll = useServerPolls(pick.port !== null && !input.ports.includes(pick.port))
  const next = nextPagePort(pick, { ...input, poll })
  if (next !== pick) setPick(next)
  return next.port
}
