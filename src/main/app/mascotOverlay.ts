import { screen, type BrowserWindow, type WebContents } from 'electron'
import type { MascotAlerts, UnreadChat } from '../../shared/chat'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import type { ChatEntry } from '../chats/entries'
import { sendTo } from '../ipc/events'
import { IS_LINUX, IS_MAC } from '../platform'
import { createMascotWindow } from './windows'

// Mascote solto na tela, por cima de qualquer app (Configurações > Experimentos > Mascote). Ele
// vive numa janela própria, transparente, do tamanho do quadro dele (o boneco e, à direita, o
// espaço do chicote e da bola do hadouken). Quem diz se está ligado são as janelas do app (a
// preferência fica no localStorage delas); o que ele faz, a própria janela do mascote decide, com
// as conversas que o processo principal manda a todas as janelas.
//
// O clique atravessa a janela até o ponteiro entrar no boneco: aí ela pega o clique, para arrastar.
// No Linux o Electron não avisa o movimento do ponteiro com o clique atravessando, então a janela
// pega sempre o clique (só no quadro pequeno dela).
//
// No Mac quem arrasta é o próprio sistema (o boneco é área de arrastar a janela, como uma barra de
// título): arrastando pela página, o clique ativava o Argus e trazia as janelas dele para a frente.
// A página não recebe o ponteiro em cima dessa área, então lá é daqui (conferindo onde o ponteiro
// está) que se vê quando ele entra e sai do boneco.

// Tamanho do quadro na tela, na proporção do desenho (200 x 172).
const SIZE = { width: 120, height: 103 }
// Ponto do boneco (mais ou menos o meio dele) que precisa estar dentro de alguma tela.
const BODY_CENTER = { x: 36, y: 50 }
// Parte do quadro onde está o boneco, em px a partir do canto da janela (BODY de MascotOverlay.tsx).
const BODY_BOX = { x: 13, y: 8, width: 46, height: 91 }
const EDGE = 12
// De quanto em quanto tempo confere onde o ponteiro está: no Mac, sempre (entrar e sair do boneco);
// nos outros, só para ver quando ele sai.
const POINTER_POLL_MS = 100
// Conversa que acabou de parar com erro: o aviso aparece por esse tempo mesmo com ela aberta na
// tela (aí ela nem chega a ficar não vista). Depois, só enquanto você não a vê.
const FRESH_ERROR_MS = 6000

export class MascotOverlay {
  private win: BrowserWindow | null = null
  private typing = false
  private watchingDisplays = false
  private leaveTimer: NodeJS.Timeout | null = null
  private hoverTimer: NodeJS.Timeout | null = null
  private interactive = false
  // Quando cada conversa parada com erro foi vista assim pela primeira vez.
  private failedAt = new Map<string, number>()
  private alertsSent = ''

  constructor(
    private unreadList: () => UnreadChat[],
    private chats: () => ChatEntry[]
  ) {}

  // Monitor desligado ou mudou de resolução: o boneco volta para uma tela que existe. Registrado
  // só ao abrir a janela: o módulo screen não pode ser usado antes do app ficar pronto, e os
  // serviços nascem antes disso.
  private watchDisplays(): void {
    if (this.watchingDisplays) return
    this.watchingDisplays = true
    const replace = (): void => {
      if (this.win && !this.win.isDestroyed()) this.win.setBounds(this.bounds())
    }
    screen.on('display-removed', replace)
    screen.on('display-metrics-changed', replace)
  }

  setEnabled(on: boolean): void {
    if (on) this.open()
    else this.close()
  }

  owns(wc: WebContents): boolean {
    return !!this.win && !this.win.isDestroyed() && this.win.webContents === wc
  }

  isMascotWindow(win: BrowserWindow): boolean {
    return win === this.win
  }

  setTyping(typing: boolean): void {
    if (typing === this.typing) return
    this.typing = typing
    if (this.win && !this.win.isDestroyed()) sendTo(this.win.webContents, 'mascot:typing', typing)
  }

  // Respostas não vistas ou conversas mudaram: avisa a janela se o resumo mudou. Roda a cada
  // pedaço de resposta chegando, então só faz conta e compara.
  refresh(): void {
    if (!this.win || this.win.isDestroyed()) return
    const alerts = this.alerts()
    const key = JSON.stringify(alerts)
    if (key === this.alertsSent) return
    this.alertsSent = key
    sendTo(this.win.webContents, 'mascot:alerts', alerts)
  }

  alerts(): MascotAlerts {
    const unread = new Set(this.unreadList().map((c) => c.id))
    const now = Date.now()
    const failed: string[] = []
    const failedSessions = new Set<string>()
    const seen = new Set<string>()
    for (const { id, state: s } of this.chats()) {
      if (s.status !== 'idle' || !s.error) continue
      seen.add(id)
      let at = this.failedAt.get(id)
      if (at === undefined) {
        at = now
        this.failedAt.set(id, now)
        // Passado o tempo de recém-parada, ela pode sair do aviso.
        setTimeout(() => this.refresh(), FRESH_ERROR_MS + 50)
      }
      const notSeen = !!s.sessionId && unread.has(s.sessionId)
      if (notSeen || now - at < FRESH_ERROR_MS) failed.push(id)
      if (s.sessionId) failedSessions.add(s.sessionId)
    }
    for (const id of this.failedAt.keys()) if (!seen.has(id)) this.failedAt.delete(id)
    const done = [...unread].filter((id) => !failedSessions.has(id)).length
    return { done, failed }
  }

  // Ponteiro em cima do boneco: a janela pega o clique; fora dele, o clique vai para o app de baixo
  // (forward: o movimento do ponteiro continua chegando, para saber quando ele volta ao boneco).
  setInteractive(on: boolean): void {
    if (IS_LINUX || IS_MAC || !this.win || this.win.isDestroyed()) return
    this.win.setIgnoreMouseEvents(!on, { forward: true })
    if (on) this.watchLeave()
    else this.stopLeave()
  }

  private pointerOnBody(win: BrowserWindow): boolean {
    const p = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const x = p.x - b.x - BODY_BOX.x
    const y = p.y - b.y - BODY_BOX.y
    return x >= 0 && x <= BODY_BOX.width && y >= 0 && y <= BODY_BOX.height
  }

  // Mac: com o ponteiro em cima do boneco, a janela pega o clique (o sistema arrasta); fora, o
  // clique atravessa. Arrastando, a janela vai junto com o ponteiro, então ele continua em cima.
  private watchHover(): void {
    this.stopHover()
    this.hoverTimer = setInterval(() => {
      const win = this.win
      if (!win || win.isDestroyed()) return this.stopHover()
      const on = this.pointerOnBody(win)
      if (on === this.interactive) return
      this.interactive = on
      win.setIgnoreMouseEvents(!on, { forward: true })
    }, POINTER_POLL_MS)
  }

  private stopHover(): void {
    if (this.hoverTimer) clearInterval(this.hoverTimer)
    this.hoverTimer = null
    this.interactive = false
  }

  // Enquanto o boneco pega o clique: o ponteiro fora dele devolve o clique ao app de baixo e avisa a
  // página (que, no Mac, não vê o ponteiro sair da área de arrastar).
  private watchLeave(): void {
    this.stopLeave()
    this.leaveTimer = setInterval(() => {
      const win = this.win
      if (!win || win.isDestroyed()) return this.stopLeave()
      if (this.pointerOnBody(win)) return
      this.stopLeave()
      win.setIgnoreMouseEvents(true, { forward: true })
      sendTo(win.webContents, 'mascot:released')
    }, POINTER_POLL_MS)
  }

  private stopLeave(): void {
    if (this.leaveTimer) clearInterval(this.leaveTimer)
    this.leaveTimer = null
  }

  dragTo(x: number, y: number): void {
    if (this.win && !this.win.isDestroyed()) this.win.setPosition(Math.round(x), Math.round(y))
  }

  dragEnd(): void {
    if (!this.win || this.win.isDestroyed()) return
    const [x, y] = this.win.getPosition()
    saveAppSettings({ mascotSpot: { x, y } })
  }

  // Dois cliques: volta ao canto de sempre.
  home(): void {
    saveAppSettings({ mascotSpot: null })
    if (this.win && !this.win.isDestroyed()) this.win.setBounds(this.bounds())
  }

  private open(): void {
    if (this.win && !this.win.isDestroyed()) return
    this.watchDisplays()
    const win = createMascotWindow(this.bounds())
    if (!IS_LINUX) win.setIgnoreMouseEvents(true, { forward: true })
    // Mac: o sistema arrasta a janela (e avisa onde ficou); daqui se vê o ponteiro no boneco.
    if (IS_MAC) {
      win.on('moved', () => this.dragEnd())
      this.watchHover()
    }
    win.on('closed', () => {
      this.stopLeave()
      this.stopHover()
      if (this.win === win) this.win = null
    })
    this.win = win
    // A página pede o resumo ao abrir; daqui em diante, só o que mudar.
    this.alertsSent = JSON.stringify(this.alerts())
  }

  private close(): void {
    this.stopLeave()
    this.stopHover()
    const win = this.win
    this.win = null
    if (win && !win.isDestroyed()) win.destroy()
  }

  // Onde a pessoa deixou, se o boneco ainda cai dentro de alguma tela; senão, o canto de baixo à
  // esquerda da tela principal, acima do Dock ou da barra de tarefas.
  private bounds(): Electron.Rectangle {
    const spot = loadAppSettings().mascotSpot
    if (spot) {
      const center = { x: spot.x + BODY_CENTER.x, y: spot.y + BODY_CENTER.y }
      const inside = screen.getAllDisplays().some(({ bounds: b }) => center.x >= b.x && center.x < b.x + b.width && center.y >= b.y && center.y < b.y + b.height)
      if (inside) return { ...spot, ...SIZE }
    }
    const area = screen.getPrimaryDisplay().workArea
    return { x: area.x + EDGE, y: area.y + area.height - SIZE.height - 4, ...SIZE }
  }
}
