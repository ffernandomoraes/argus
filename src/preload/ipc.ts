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
