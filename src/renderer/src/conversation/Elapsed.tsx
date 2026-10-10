import { useNow } from '../lib/clock'
import { formatDuration } from './format'

// Tempo correndo desde o início do pedido, atualizado a cada segundo. O relógio é o da janela
// (lib/clock): vários contadores na tela são um timer só e mudam juntos.
export function Elapsed({ since }: { since: number }) {
  const now = useNow(1000)
  return <>{formatDuration(now - since)}</>
}
