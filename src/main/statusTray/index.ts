import { app, BrowserWindow, Menu, nativeTheme, Tray } from 'electron'
import type { UnreadChat } from '../../shared/chat'
import { statusSignature, StatusChanges, type ChatEntry } from '../chats/entries'
import { sessionTitles } from '../chats/titles'
import { IS_MAC } from '../platform'
import { drawIcons, FRAMES } from './icons'
import { tooltip, topKind, type Finished, type Kind } from './kinds'
import { trayMenu, trayRows } from './menu'

// Ícone com o estado das conversas abertas neste app: na barra de menus do macOS, ou na área de
// notificação do Windows (perto do relógio). "Concluído" é a resposta que você ainda não viu (a
// bolinha verde da lista) e fica até você abrir a conversa; no Mac, o número ao lado do ícone conta
// essas. "Erro" fica marcado até você voltar ao app.

// De onde o ícone lê as conversas e o que o clique numa delas faz.
export type TraySources = {
  chats: () => ChatEntry[]
  unread: () => UnreadChat[]
  showApp: () => void
  openChat: (cwd: string, sessionId: string) => void
}

// No pnpm dev o ícone e o menu mudam, para não confundir com o Argus instalado aberto ao mesmo tempo.
const DEV = !app.isPackaged

const FRAME_MS = 90

export class StatusTray {
  private tray: Tray
  private icons = drawIcons(DEV)
  private entries: ChatEntry[] = []
  private changes = new StatusChanges()
  private signature: string | null = null
  private unread: UnreadChat[] = []
  // Conversas que pararam com erro enquanto você estava fora do app. Continuam aqui mesmo depois
  // que a sessão é encerrada (conversa fechada na tela), até você voltar ao app.
  private finished = new Map<string, Finished>()
  private count = ''
  private shown: Kind | null = null
  private tip = ''
  private timer: NodeJS.Timeout | null = null
  private frame = 0

  constructor(private sources: TraySources) {
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
    const entries = this.sources.chats()
    const unread = this.sources.unread()
    const signature = `${statusSignature(entries)}#${unread.map((u) => u.id).join('|')}`
    if (signature === this.signature) return
    this.signature = signature
    this.entries = entries
    this.unread = unread
    for (const { entry, before } of this.changes.next(entries)) {
      const { id, cwd, state } = entry
      if (state.status !== 'idle') this.finished.delete(id)
      else if (before && state.error && !BrowserWindow.getFocusedWindow()) {
        // Parou com erro com você em outro app: fica marcado até você voltar.
        this.finished.set(id, { cwd, sessionId: state.sessionId, kind: 'error' })
      }
    }
    this.paint()
  }

  // Você voltou ao app: os avisos de erro já foram vistos.
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
    const kinds = trayRows(this.entries, this.finished, this.unread).map((r) => r.kind)
    const tip = tooltip(app.name, kinds)
    if (tip !== this.tip) {
      this.tip = tip
      this.tray.setToolTip(tip)
    }
    // Só o macOS escreve texto ao lado do ícone; no Windows a contagem fica na dica e no menu.
    const done = kinds.filter((k) => k === 'done').length
    const count = done ? String(done) : ''
    if (IS_MAC && count !== this.count) {
      this.count = count
      this.tray.setTitle(count, { fontType: 'monospacedDigit' })
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
    const rows = trayRows(this.entries, this.finished, this.unread)
    const titles = new Map<string, string>()
    const untitled = rows.filter((r) => r.title === undefined)
    const read = await Promise.all([...new Set(untitled.map((r) => r.cwd))].map((cwd) => sessionTitles(cwd)))
    for (const t of read) t.forEach((title, id) => titles.set(id, title))
    const items = trayMenu(rows, titles, {
      mac: IS_MAC,
      header: DEV ? `${app.name} - Desenvolvimento` : `${app.name} ${app.getVersion()}`,
      appName: app.name,
      icon: (kind) => this.icons.kinds[kind],
      showApp: this.sources.showApp,
      openChat: this.sources.openChat
    })
    this.tray.popUpContextMenu(Menu.buildFromTemplate(items))
  }
}
