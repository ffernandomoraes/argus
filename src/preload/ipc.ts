import { ipcRenderer } from 'electron'
import type { EventChannels, InvokeChannels, SendChannels, SendSyncChannels } from '../shared/ipc'

// Chamadas ao processo principal tipadas pelo contrato (src/shared/ipc.ts): canal e argumentos
// errados são erro de tipo aqui, e o handler do outro lado é conferido pelo mesmo mapa.

export function invoke<C extends keyof InvokeChannels>(
  channel: C,
  ...args: Parameters<InvokeChannels[C]>
): Promise<Awaited<ReturnType<InvokeChannels[C]>>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<Awaited<ReturnType<InvokeChannels[C]>>>
}

export function send<C extends keyof SendChannels>(channel: C, ...args: Parameters<SendChannels[C]>): void {
  ipcRenderer.send(channel, ...args)
}

export function sendSync<C extends keyof SendSyncChannels>(
  channel: C,
  ...args: Parameters<SendSyncChannels[C]>
): ReturnType<SendSyncChannels[C]> {
  return ipcRenderer.sendSync(channel, ...args) as ReturnType<SendSyncChannels[C]>
}

type Callback = (...args: unknown[]) => void

// Um ouvinte do ipcRenderer por canal, repassando a quem se inscreveu: com um ouvinte por inscrição,
// 10+ terminais ou conversas abertas passavam do limite do Node e geravam aviso.
const subscribers = new Map<string, Set<Callback>>()

function dispatch(channel: string, set: Set<Callback>, args: unknown[]): void {
  // Cópia: quem sai ou entra durante o aviso não muda esta rodada (como no EventEmitter).
  for (const cb of [...set]) {
    try {
      cb(...args)
    } catch (err) {
      // Um ouvinte com erro não impede os outros de receber.
      console.error(`[ipc] erro ao tratar ${channel}:`, err)
    }
  }
}

export function listen<C extends keyof EventChannels>(channel: C, cb: EventChannels[C]): () => void {
  let set = subscribers.get(channel)
  if (!set) {
    const created = new Set<Callback>()
    subscribers.set(channel, created)
    ipcRenderer.on(channel, (_e, ...args: unknown[]) => dispatch(channel, created, args))
    set = created
  }
  // Uma entrada por inscrição: a mesma função inscrita duas vezes recebe duas vezes e sai uma de
  // cada vez, como antes com um ouvinte por inscrição.
  const entry: Callback = (...args) => (cb as Callback)(...args)
  set.add(entry)
  const mine = set
  return () => {
    mine.delete(entry)
  }
}

// Os argumentos de um evento depois da chave (o primeiro).
type AfterKey<F> = F extends (key: string, ...rest: infer R) => void ? R : never

// Ouvintes de um canal cujo primeiro argumento é uma chave (a saída de cada terminal): só quem se
// inscreveu naquela chave recebe, já sem ela. Com o listen, cada pedaço de saída passava por todos
// os terminais abertos, e cada passagem para a página copia o texto (10 terminais, 10 cópias).
const keyed = new Map<string, Map<string, Set<Callback>>>()

export function listenKey<C extends keyof EventChannels>(channel: C, key: string, cb: (...args: AfterKey<EventChannels[C]>) => void): () => void {
  let byKey = keyed.get(channel)
  if (!byKey) {
    const created = new Map<string, Set<Callback>>()
    keyed.set(channel, created)
    ipcRenderer.on(channel, (_e, k: unknown, ...rest: unknown[]) => {
      const set = typeof k === 'string' ? created.get(k) : undefined
      if (set) dispatch(channel, set, rest)
    })
    byKey = created
  }
  let set = byKey.get(key)
  if (!set) {
    set = new Set<Callback>()
    byKey.set(key, set)
  }
  const entry: Callback = (...args) => (cb as Callback)(...args)
  set.add(entry)
  const mine = set
  const owner = byKey
  return () => {
    mine.delete(entry)
    if (!mine.size && owner.get(key) === mine) owner.delete(key)
  }
}
