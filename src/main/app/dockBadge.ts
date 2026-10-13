import { app, BrowserWindow, nativeImage, type NativeImage } from 'electron'
import type { UnreadChat } from '../../shared/chat'
import type { ChatEntry } from '../chats/entries'
import { tr } from '../i18n'
import { IS_WIN } from '../platform'

// Número no ícone do app (Dock do Mac, como o do Teams): conversas com resposta que você ainda não
// viu, mais as que estão esperando você. Cada uma sai sozinha: a não vista quando você abre aquela
// conversa, a que espera você quando você responde. Voltar ao app não zera nada.
// Windows: a barra de tarefas não mostra número, então vai uma bolinha vermelha sobre o ícone.
export class DockBadge {
  private count = -1
  private dot: NativeImage | null = null

  constructor(
    private chats: () => ChatEntry[],
    private unread: () => UnreadChat[]
  ) {
    // Janela aberta depois do aviso nasce sem a bolinha.
    if (IS_WIN) app.on('browser-window-created', (_e, win) => this.overlay(win))
  }

  refresh(): void {
    const ids = new Set(this.unread().map((u) => u.id))
    for (const { id, state } of this.chats()) if (state.status === 'needs-you') ids.add(state.sessionId ?? id)
    if (ids.size === this.count) return
    this.count = ids.size
    if (IS_WIN) for (const win of BrowserWindow.getAllWindows()) this.overlay(win)
    else app.setBadgeCount(this.count)
  }

  private overlay(win: BrowserWindow): void {
    if (win.isDestroyed()) return
    if (this.count <= 0) return win.setOverlayIcon(null, '')
    win.setOverlayIcon((this.dot ??= redDot()), tr(`${this.count} conversas para ver`, `${this.count} chats to check`))
  }
}

// Bolinha vermelha de 16 px, desenhada pixel a pixel (BGRA, com a cor já multiplicada pela
// transparência, como o Electron espera) para não depender de arquivo de imagem.
function redDot(): NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Borda suavizada: o pixel no limite do círculo fica meio transparente.
      const alpha = Math.max(0, Math.min(1, c + 0.5 - Math.hypot(x - c, y - c)))
      const i = (y * size + x) * 4
      buf[i] = Math.round(0x30 * alpha)
      buf[i + 1] = Math.round(0x3b * alpha)
      buf[i + 2] = Math.round(0xff * alpha)
      buf[i + 3] = Math.round(alpha * 255)
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}
