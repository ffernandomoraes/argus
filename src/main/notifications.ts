import { homedir } from 'node:os'
import { basename } from 'node:path'
import { BrowserWindow, Notification } from 'electron'
import type { ChatState } from '../shared/chat'
import { listSessions } from './sessions'

// Notificação do sistema quando uma conversa aberta no app precisa de você, termina ou para com
// erro. Só com o app fora de foco: olhando o app, o canvas já mostra o status.

type Entry = { id: string; cwd: string; state: ChatState }
type Kind = 'needs-you' | 'done' | 'error'

const LABEL: Record<Kind, string> = {
  'needs-you': 'Precisa de você',
  done: 'Concluído',
  error: 'Parou com erro'
}

function kindOf(state: ChatState): Kind | null {
  if (state.status === 'needs-you') return 'needs-you'
  if (state.status === 'idle') return state.error ? 'error' : 'done'
  return null
}

export class ChatNotifier {
  private previous = new Map<string, ChatState['status']>()
  // Guardadas até o clique: notificação recolhida da memória perde o evento de clique.
  private shown = new Set<Notification>()

  constructor(
    private list: () => Entry[],
    private open: (cwd: string, sessionId?: string) => void
  ) {}

  // Chamado a cada mudança de estado de uma conversa.
  refresh(): void {
    const seen = new Set<string>()
    for (const { id, cwd, state } of this.list()) {
      seen.add(id)
      const before = this.previous.get(id)
      this.previous.set(id, state.status)
      if (!before || before === state.status) continue
      const kind = kindOf(state)
      if (kind && !BrowserWindow.getFocusedWindow()) void this.show(kind, cwd, state.sessionId)
    }
    for (const id of this.previous.keys()) if (!seen.has(id)) this.previous.delete(id)
  }

  private async show(kind: Kind, cwd: string, sessionId?: string): Promise<void> {
    if (!Notification.isSupported()) return
    let title = 'Conversa nova'
    try {
      title = (await listSessions(cwd)).find((s) => s.id === sessionId)?.title ?? title
    } catch {
      // sem título: usa o texto padrão
    }
    const project = cwd === homedir() ? 'Sem projeto' : basename(cwd) || cwd
    const n = new Notification({ title: `${LABEL[kind]} - ${project}`, body: title })
    n.on('click', () => {
      this.shown.delete(n)
      this.open(cwd, sessionId)
    })
    n.on('close', () => this.shown.delete(n))
    this.shown.add(n)
    n.show()
  }
}
