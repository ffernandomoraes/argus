import { app, BrowserWindow, Menu, nativeTheme, Tray } from 'electron'
import { statusSignature, StatusChanges, type ChatEntry } from '../chats/entries'
import { sessionTitles } from '../chats/titles'
import { IS_MAC } from '../platform'
import { drawIcons, FRAMES } from './icons'
import { tooltip, topKind, type Finished, type Kind } from './kinds'
import { trayMenu, trayRows } from './menu'

// Ícone com o estado das conversas abertas neste app: na barra de menus do macOS, ou na área de
// notificação do Windows (perto do relógio). "Concluído" e "erro" ficam marcados até você voltar
// ao app.

// No pnpm dev o ícone e o menu mudam, para não confundir com o Argus instalado aberto ao mesmo tempo.
const DEV = !app.isPackaged

const FRAME_MS = 90

export class StatusTray {
  private tray: Tray
  private icons = drawIcons(DEV)
  private entries: ChatEntry[] = []
  private changes = new StatusChanges()
  private signature: string | null = null
  // Conversas que terminaram enquanto você estava fora do app. Continuam aqui mesmo depois que
  // a sessão é encerrada (conversa fechada na tela), até você voltar ao app.
  private finished = new Map<string, Finished>()
  private shown: Kind | null = null
  private tip = ''
  private timer: NodeJS.Timeout | null = null
  private frame = 0

  constructor(
    private list: () => ChatEntry[],
    private showApp: () => void
  ) {
    this.tray = new Tray(this.icons.kinds.idle)
    const open = (): void => void this.openMenu()
    this.tray.on('click', open)
    this.tray.on('right-click', open)
    // Windows: a barra de tarefas trocou de tema claro para escuro (ou o contrário).
    if (!IS_MAC) nativeTheme.on('updated', this.redraw)
    this.refresh()
  }

  private redraw = (): void => {
    this.icons = drawIcons(DEV)
    this.shown = null
    this.paint()
  }

  // Chamado a cada mudança de estado de uma conversa. Sai cedo quando nada do que o ícone mostra
  // mudou (o texto chegando aos pedaços).
  refresh(): void {
    const entries = this.list()
    const signature = statusSignature(entries)
    if (signature === this.signature) return
    this.signature = signature
    this.entries = entries
    for (const { entry, before } of this.changes.next(entries)) {
      const { id, cwd, state } = entry
      if (state.status !== 'idle') this.finished.delete(id)
      else if (before && !BrowserWindow.getFocusedWindow()) {
        // Terminou com você em outro app: fica marcado até você voltar.
        this.finished.set(id, { cwd, sessionId: state.sessionId, kind: state.error ? 'error' : 'done' })
      }
    }
    this.paint()
  }

  // Você voltou ao app: os avisos de concluído já foram vistos.
  seen(): void {
    if (!this.finished.size) return
    this.finished.clear()
    this.paint()
  }

  destroy(): void {
    this.stopSpinner()
    nativeTheme.off('updated', this.redraw)
    this.tray.destroy()
  }

  // Dica e ícone só mudam quando o que mostram muda.
  private paint(): void {
    const kinds = trayRows(this.entries, this.finished).map((r) => r.kind)
    const tip = tooltip(app.name, kinds)
    if (tip !== this.tip) {
      this.tip = tip
      this.tray.setToolTip(tip)
    }
    const top = topKind(kinds)
    if (top === this.shown) return
    this.shown = top
    if (top === 'running') this.startSpinner()
    else {
      this.stopSpinner()
      this.tray.setImage(this.icons.kinds[top])
    }
  }

  private startSpinner(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % FRAMES
      this.tray.setImage(this.icons.spinner[this.frame])
    }, FRAME_MS)
  }

  private stopSpinner(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // Menu montado na hora do clique: os títulos vêm dos arquivos das sessões.
  private async openMenu(): Promise<void> {
    const rows = trayRows(this.entries, this.finished)
    const titles = new Map<string, string>()
    const read = await Promise.all([...new Set(rows.map((r) => r.cwd))].map((cwd) => sessionTitles(cwd)))
    for (const t of read) t.forEach((title, id) => titles.set(id, title))
    const items = trayMenu(rows, titles, {
      mac: IS_MAC,
      header: DEV ? `${app.name} - Desenvolvimento` : `${app.name} ${app.getVersion()}`,
      appName: app.name,
      icon: (kind) => this.icons.kinds[kind],
      showApp: this.showApp
    })
    this.tray.popUpContextMenu(Menu.buildFromTemplate(items))
  }
}
