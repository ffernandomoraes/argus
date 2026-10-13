import { homedir } from 'node:os'
import { basename } from 'node:path'
import { BrowserWindow, Notification } from 'electron'
import type { ChatState } from '../shared/chat'
import { statusSignature, StatusChanges, titleOf, type ChatEntry } from './chats/entries'
import { sessionTitles } from './chats/titles'
import { tr } from './i18n'

// Notificação do sistema quando uma conversa aberta no app precisa de você, termina ou para com
// erro. Só com o app fora de foco: olhando o app, o canvas já mostra o status.

type Kind = 'needs-you' | 'done' | 'error'

// Função, não constante: o idioma pode mudar com o app aberto.
const label = (kind: Kind): string =>
  kind === 'needs-you' ? tr('Precisa de você', 'Needs you')
  : kind === 'done' ? tr('Concluído', 'Done')
  : tr('Parou com erro', 'Stopped with error')

// Guardadas até o clique: notificação recolhida da memória perde o evento de clique. O aviso de
// fechada nem sempre chega, então ficam só as mais recentes.
const KEEP_SHOWN = 20

function kindOf(state: ChatState): Kind | null {
  if (state.status === 'needs-you') return 'needs-you'
  if (state.status === 'idle') return state.error ? 'error' : 'done'
  return null
}

export class ChatNotifier {
  private changes = new StatusChanges()
  private signature: string | null = null
  private shown = new Set<Notification>()

  constructor(
    private list: () => ChatEntry[],
    private open: (cwd: string, sessionId?: string) => void
  ) {}

  // Chamado a cada mudança de estado de uma conversa. Sai cedo quando nenhum status mudou (o texto
  // chegando aos pedaços).
  refresh(): void {
    const entries = this.list()
    const signature = statusSignature(entries)
    if (signature === this.signature) return
    this.signature = signature
    for (const { entry, before } of this.changes.next(entries)) {
      const kind = before && kindOf(entry.state)
      if (kind && !BrowserWindow.getFocusedWindow()) void this.show(kind, entry.cwd, entry.state.sessionId)
    }
  }

  private async show(kind: Kind, cwd: string, sessionId?: string): Promise<void> {
    if (!Notification.isSupported()) return
    const title = titleOf(sessionId ? await sessionTitles(cwd) : new Map(), sessionId)
    const project = cwd === homedir() ? tr('Sem projeto', 'No project') : basename(cwd) || cwd
    const n = new Notification({ title: `${label(kind)} - ${project}`, body: title })
    n.on('click', () => {
      this.shown.delete(n)
      this.open(cwd, sessionId)
    })
    n.on('close', () => this.shown.delete(n))
    this.keep(n)
    n.show()
  }

  private keep(n: Notification): void {
    this.shown.add(n)
    for (const old of this.shown) {
      if (this.shown.size <= KEEP_SHOWN) break
      this.shown.delete(old)
    }
  }
}
