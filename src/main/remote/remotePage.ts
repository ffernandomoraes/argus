import { EventEmitter } from 'node:events'
import { REMOTE_PAGE, type Page } from '../ipc/page'

// Uma janela de outro computador, vista daqui (do Argus de casa): faz o papel do webContents para
// quem guarda coisas por página (terminais abertos, conversas seguras, pastas vigiadas). O aviso
// mandado a ela vai pela ligação; recarregar lá vira `did-navigate` aqui, e fechar a janela ou cair
// a ligação vira `destroyed`, como numa janela daqui.
export class RemotePage extends EventEmitter implements Page {
  // Longe dos ids dos webContents (que começam em 1), para nunca coincidir nos mapas por id.
  private static nextId = 1_000_000_000
  readonly id = RemotePage.nextId++
  readonly [REMOTE_PAGE] = true
  private destroyed = false

  constructor(private deliver: (channel: string, args: unknown[]) => void) {
    super()
  }

  send(channel: string, ...args: unknown[]): void {
    if (!this.destroyed) this.deliver(channel, args)
  }

  isDestroyed(): boolean {
    return this.destroyed
  }

  navigated(): void {
    if (!this.destroyed) this.emit('did-navigate')
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.emit('destroyed')
    this.removeAllListeners()
  }
}
