import { BrowserWindow } from 'electron'

// Conversas abertas em janela própria. Os dados da conversa vêm da janela principal
// (por enquanto são de exemplo e vivem lá); a janela nova pede esses dados ao abrir.
type Popout = { win: BrowserWindow; payload: unknown }

export class Popouts {
  private open = new Map<string, Popout>()

  constructor(
    private createWindow: (hash: string) => BrowserWindow,
    private onClosed: (id: string) => void
  ) {}

  // Abre a janela da conversa, ou traz para frente se já estiver aberta.
  show(id: string, payload: unknown): void {
    const existing = this.open.get(id)
    if (existing) {
      if (existing.win.isMinimized()) existing.win.restore()
      existing.win.focus()
      return
    }
    const win = this.createWindow(`popout/${encodeURIComponent(id)}`)
    this.open.set(id, { win, payload })
    win.on('closed', () => {
      this.open.delete(id)
      this.onClosed(id)
    })
  }

  payload(id: string): unknown {
    return this.open.get(id)?.payload
  }

  isOpen(id: string): boolean {
    return this.open.has(id)
  }
}
