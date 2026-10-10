import { IS_WIN } from '../platform'
import { scanMac } from './mac'
import type { Listening } from './types'
import { scanWindows } from './win'

// Varredura de portas e processos, uma para o app inteiro: o painel de servidores, o botão de
// cada pasta e cada janela perguntam ao mesmo tempo, e cada volta abre cinco processos no Mac (o
// PowerShell no Windows). Vale a última por um instante, e quem pergunta durante uma varredura
// espera a mesma.
export { APP_MARK, marked } from './marks'
export { terminate } from './terminate'
export type { Listening } from './types'

const TTL = 1000

let cache: { at: number; list: Listening[] } | null = null
let pending: { generation: number; promise: Promise<Listening[]> } | null = null
// Muda quando algo é iniciado ou encerrado: a varredura que já estava em curso fica velha.
let generation = 0

// `fresh`: sem a guardada (antes de encerrar algo, a conferência é na hora).
export function scanListening({ fresh = false }: { fresh?: boolean } = {}): Promise<Listening[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.list)
  if (pending && pending.generation === generation) return pending.promise
  const started = generation
  const promise = (IS_WIN ? scanWindows() : scanMac())
    .then((list) => {
      if (started === generation) cache = { at: Date.now(), list }
      return list
    })
    .finally(() => {
      if (pending?.promise === promise) pending = null
    })
  pending = { generation: started, promise }
  return promise
}

// Servidor iniciado ou encerrado daqui: a próxima pergunta varre de novo.
export function invalidateScan(): void {
  generation++
  cache = null
}
