import { StatusTray, type TraySources } from '../statusTray'

// Ícone com o status das conversas na barra de menus (Mac) ou na bandeja (Windows). Criado com o
// app pronto (o Tray exige); nulo também quando desligado nas configurações.
export class MenuBarIcon {
  private tray: StatusTray | null = null

  constructor(private sources: TraySources) {}

  set(on: boolean): void {
    if (on && !this.tray) this.tray = new StatusTray(this.sources)
    if (!on) this.destroy()
  }

  // Uma conversa mudou de estado.
  refresh(): void {
    this.tray?.refresh()
  }

  // Você voltou ao app: os avisos de erro já foram vistos.
  seen(): void {
    this.tray?.seen()
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
