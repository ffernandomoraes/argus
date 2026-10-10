import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { InvokeChannels, SendChannels, SendSyncChannels } from '../../shared/ipc'
import { isAppFrame } from '../app/appUrl'

// Registro dos canais, tipados pelo contrato (src/shared/ipc.ts): um handler com argumentos ou
// resposta diferentes do canal é erro de tipo. Todos aceitam só o quadro principal de uma janela do
// app; o resto (a página do protótipo, um site que a janela tenha aberto) é recusado.

type Awaitable<T> = T | Promise<T>

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

// Pedido com resposta (invoke). O erro volta para a janela como promessa rejeitada.
export function handle<C extends keyof InvokeChannels>(
  channel: C,
  handler: (e: IpcMainInvokeEvent, ...args: Parameters<InvokeChannels[C]>) => Awaitable<ReturnType<InvokeChannels[C]>>
): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!fromApp(e, channel)) throw new Error(`Canal ${channel} recusado.`)
    return handler(e, ...(args as Parameters<InvokeChannels[C]>))
  })
}

// Mensagem sem resposta (send). Pode devolver uma promessa: a falha dela também fica registrada.
export function on<C extends keyof SendChannels>(
  channel: C,
  handler: (e: IpcMainEvent, ...args: Parameters<SendChannels[C]>) => unknown
): void {
  ipcMain.on(channel, (e, ...args) => {
    if (!fromApp(e, channel)) return
    try {
      const result = handler(e, ...(args as Parameters<SendChannels[C]>))
      if (result instanceof Promise) result.catch((err: unknown) => report(channel, err))
    } catch (err) {
      report(channel, err)
    }
  })
}

// Síncrona (sendSync): a janela fica parada até a resposta, então sempre responde; recusada ou com
// erro, responde nulo.
export function onSync<C extends keyof SendSyncChannels>(
  channel: C,
  handler: (e: IpcMainEvent, ...args: Parameters<SendSyncChannels[C]>) => ReturnType<SendSyncChannels[C]>
): void {
  ipcMain.on(channel, (e, ...args) => {
    if (!fromApp(e, channel)) {
      e.returnValue = null
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
