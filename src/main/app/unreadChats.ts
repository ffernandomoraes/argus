import type { WebContents } from 'electron'
import type { UnreadChat } from '../../shared/chat'

// Respostas que você ainda não viu (a bolinha verde da lista), como cada janela conta: quem marca
// e desmarca é a janela, que sabe o que está na tela. O ícone da barra de menus mostra todas.
export class UnreadChats {
  private byWindow = new Map<number, UnreadChat[]>()

  constructor(private onChange: () => void) {}

  set(sender: WebContents, chats: UnreadChat[]): void {
    const id = sender.id
    if (!this.byWindow.has(id)) {
      sender.once('destroyed', () => {
        this.byWindow.delete(id)
        this.onChange()
      })
    }
    this.byWindow.set(id, chats)
    this.onChange()
  }

  // Sem repetir a conversa que duas janelas contam.
  list(): UnreadChat[] {
    const out = new Map<string, UnreadChat>()
    for (const chats of this.byWindow.values()) for (const c of chats) out.set(c.id, c)
    return [...out.values()]
  }
}
