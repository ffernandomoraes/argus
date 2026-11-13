import { BrowserWindow, type WebContents } from 'electron'
import type { EventChannels } from '@argus/shared/ipc'
import type { Page } from './page'

// Avisos do processo principal para as janelas, tipados pelo contrato (packages/shared/src/ipc.ts).

export function sendTo<C extends keyof EventChannels>(page: Page, channel: C, ...args: Parameters<EventChannels[C]>): void {
  if (!page.isDestroyed()) page.send(channel, ...args)
}

// Páginas de outro computador ligadas por acesso remoto (no Argus de casa): recebem os avisos como
// as janelas daqui.
const remotePages = new Set<Page>()

export function addRemotePage(page: Page): void {
  remotePages.add(page)
}

export function removeRemotePage(page: Page): void {
  remotePages.delete(page)
}

export function remotePageList(): Page[] {
  return [...remotePages]
}

// Janelas daqui que mostram outro Argus (no notebook): os avisos delas vêm de lá, não daqui.
let mirrorsRemote: (wc: WebContents) => boolean = () => false

export function setRemoteWindowCheck(fn: (wc: WebContents) => boolean): void {
  mirrorsRemote = fn
}

// Só para as janelas deste computador que mostram ele mesmo (nem as de acesso remoto daqui, nem as
// páginas de outro computador): o que é da máquina, como os aparelhos pareados.
export function broadcastLocal<C extends keyof EventChannels>(channel: C, ...args: Parameters<EventChannels[C]>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!mirrorsRemote(win.webContents)) sendTo(win.webContents, channel, ...args)
  }
}

// Para todas as janelas abertas.
export function broadcast<C extends keyof EventChannels>(channel: C, ...args: Parameters<EventChannels[C]>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!mirrorsRemote(win.webContents)) sendTo(win.webContents, channel, ...args)
  }
  for (const page of remotePages) sendTo(page, channel, ...args)
}
