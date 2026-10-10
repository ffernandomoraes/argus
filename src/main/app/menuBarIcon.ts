import { StatusTray } from '../statusTray'

type Entry = ConstructorParameters<typeof StatusTray>[0]

// Ícone com o status das conversas na barra de menus (Mac) ou na bandeja (Windows). Criado com o
// app pronto (o Tray exige); nulo também quando desligado nas configurações.
export class MenuBarIcon {
  private tray: StatusTray | null = null

  constructor(
    private list: Entry,
    private showApp: () => void
  ) {}

  set(on: boolean): void {
    if (on && !this.tray) this.tray = new StatusTray(this.list, this.showApp)
    if (!on) this.destroy()
  }

  // Uma conversa mudou de estado.
  refresh(): void {
    this.tray?.refresh()
  }

  // Você voltou ao app: os avisos de concluído já foram vistos.
  seen(): void {
    this.tray?.seen()
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
