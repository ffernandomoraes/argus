import { BrowserWindow, type WebContents } from 'electron'
import type { EventChannels } from '../../shared/ipc'

// Avisos do processo principal para as janelas, tipados pelo contrato (src/shared/ipc.ts).

export function sendTo<C extends keyof EventChannels>(wc: WebContents, channel: C, ...args: Parameters<EventChannels[C]>): void {
  if (!wc.isDestroyed()) wc.send(channel, ...args)
}

// Para todas as janelas abertas.
export function broadcast<C extends keyof EventChannels>(channel: C, ...args: Parameters<EventChannels[C]>): void {
  for (const win of BrowserWindow.getAllWindows()) sendTo(win.webContents, channel, ...args)
}
