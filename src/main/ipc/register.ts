import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import type { InvokeChannels, SendChannels, SendSyncChannels } from '../../shared/ipc'
import { isAppFrame } from '../app/appUrl'
import { blockedReply, channelPolicy } from '../remote/policy'
import type { Caller } from './page'

// Registro dos canais, tipados pelo contrato (src/shared/ipc.ts): um handler com argumentos ou
// resposta diferentes do canal é erro de tipo. Todos aceitam só o quadro principal de uma janela do
// app; o resto (um iframe, um site que a janela tenha aberto) é recusado.
//
// Acesso remoto (src/main/remote): os handlers ficam guardados aqui também, para o Argus de casa
// atender os pedidos que chegam de outro computador (`dispatch`, com a página remota como quem
// chamou). No notebook, o pedido de uma janela remota não chega ao handler daqui: vai para o Argus
// de casa (`setRemoteRoute`), salvo o que é da própria máquina (ver remote/policy.ts).

type Awaitable<T> = T | Promise<T>

export type CallKind = 'invoke' | 'send' | 'sync'

type AnyHandler = (caller: Caller, ...args: unknown[]) => unknown

const handlers = new Map<string, { kind: CallKind; fn: AnyHandler }>()

// Para onde vão os pedidos de uma janela remota (no notebook): o Argus do outro computador.
export interface RemoteRoute {
  call(kind: CallKind, channel: string, args: unknown[]): Promise<unknown>
}

let routeOf: (wc: WebContents) => RemoteRoute | null = () => null

export function setRemoteRoute(fn: (wc: WebContents) => RemoteRoute | null): void {
  routeOf = fn
}

function fromApp(e: IpcMainEvent | IpcMainInvokeEvent, channel: string): boolean {
  if (isAppFrame(e.senderFrame)) return true
  console.warn(`[ipc] ${channel} recusado: não veio de uma janela do app`)
  return false
}

// Erro num handler sem resposta não vira exceção solta no processo principal (o diálogo "A
// JavaScript error occurred in the main process"): fica registrado e o app segue.
function report(channel: string, err: unknown): void {
  console.error(`[ipc] erro em ${channel}:`, err)
}

// A rota remota de quem chamou, se o canal vai para o outro computador. `blocked`: nem lá, nem aqui.
function remoteFor(wc: WebContents, channel: string): RemoteRoute | 'blocked' | null {
  const route = routeOf(wc)
  if (!route) return null
  const policy = channelPolicy(channel)
  return policy === 'local' ? null : policy === 'blocked' ? 'blocked' : route
}

// Pedido com resposta (invoke). O erro volta para a janela como promessa rejeitada.
export function handle<C extends keyof InvokeChannels>(
  channel: C,
  handler: (e: Caller, ...args: Parameters<InvokeChannels[C]>) => Awaitable<ReturnType<InvokeChannels[C]>>
): void {
  handlers.set(channel, { kind: 'invoke', fn: handler as AnyHandler })
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromApp(e, channel)) throw new Error(`Canal ${channel} recusado.`)
    const remote = remoteFor(e.sender, channel)
    if (remote === 'blocked') return blockedReply(channel)
    if (remote) return remote.call('invoke', channel, args)
    return handler(e, ...(args as Parameters<InvokeChannels[C]>))
  })
}

// Mensagem sem resposta (send). Pode devolver uma promessa: a falha dela também fica registrada.
export function on<C extends keyof SendChannels>(
  channel: C,
  handler: (e: Caller, ...args: Parameters<SendChannels[C]>) => unknown
): void {
  handlers.set(channel, { kind: 'send', fn: handler as AnyHandler })
  ipcMain.on(channel, (e, ...args) => {
    if (!fromApp(e, channel)) return
    const remote = remoteFor(e.sender, channel)
    if (remote === 'blocked') return
    if (remote) return void remote.call('send', channel, args).catch((err: unknown) => report(channel, err))
    runSend(channel, handler as AnyHandler, e, args)
  })
}

function runSend(channel: string, fn: AnyHandler, caller: Caller, args: unknown[]): void {
  try {
    const result = fn(caller, ...args)
    if (result instanceof Promise) result.catch((err: unknown) => report(channel, err))
  } catch (err) {
    report(channel, err)
  }
}

// Síncrona (sendSync): a janela fica parada até a resposta, então sempre responde; recusada ou com
// erro, responde nulo. Na janela remota a resposta vem da rede: o returnValue é dado quando ela
// chega (a janela segue parada até lá).
export function onSync<C extends keyof SendSyncChannels>(
  channel: C,
  handler: (e: Caller, ...args: Parameters<SendSyncChannels[C]>) => ReturnType<SendSyncChannels[C]>
): void {
  handlers.set(channel, { kind: 'sync', fn: handler as AnyHandler })
  ipcMain.on(channel, (e, ...args) => {
    if (!fromApp(e, channel)) {
      e.returnValue = null
      return
    }
    const remote = remoteFor(e.sender, channel)
    if (remote === 'blocked') {
      e.returnValue = blockedReply(channel)
      return
    }
    if (remote) {
      remote.call('sync', channel, args).then(
        (value) => (e.returnValue = value ?? null),
        (err: unknown) => {
          report(channel, err)
          e.returnValue = null
        }
      )
      return
    }
    try {
      e.returnValue = handler(e, ...(args as Parameters<SendSyncChannels[C]>))
    } catch (err) {
      report(channel, err)
      e.returnValue = null
    }
  })
}

// Um pedido que chegou de outro computador (src/main/remote/host.ts). Só canais "remotos" (ver
// remote/policy.ts) e do mesmo tipo com que foram registrados; o resto é recusado.
export async function dispatch(kind: CallKind, channel: string, caller: Caller, args: unknown[]): Promise<unknown> {
  const entry = handlers.get(channel)
  if (!entry || entry.kind !== kind || channelPolicy(channel) !== 'remote') {
    throw new Error(`Canal ${channel} recusado no acesso remoto.`)
  }
  if (kind === 'send') {
    runSend(channel, entry.fn, caller, args)
    return undefined
  }
  if (kind === 'sync') {
    try {
      return entry.fn(caller, ...args) ?? null
    } catch (err) {
      report(channel, err)
      return null
    }
  }
  return await entry.fn(caller, ...args)
}
