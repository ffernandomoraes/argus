import type { ActiveChat, ChatState } from '../../shared/chat'

// Uma conversa aberta no app (ver Chats.list), como a bandeja e as notificações enxergam.
export type ChatEntry = { id: string; cwd: string; state: ChatState }

type Status = ChatState['status']

// Título que aparece no lugar do da conversa: nova, ou o arquivo da sessão não deu para ler.
const UNTITLED = 'Conversa nova'

// Título da conversa entre os lidos dos arquivos das sessões (ver sessionTitles).
export function titleOf(titles: Map<string, string>, sessionId?: string): string {
  return (sessionId && titles.get(sessionId)) || UNTITLED
}

// Resumo do que muda o ícone da bandeja e as notificações: status, erro e subagentes de cada
// conversa. O texto chegando aos pedaços (um aviso a cada ~50 ms) não muda nada disso, então quem
// compara com o resumo anterior sai cedo.
export function statusSignature(entries: ChatEntry[]): string {
  return entries
    .map(({ id, state: s }) => `${id}:${s.status}:${s.error ? 1 : 0}:${s.agents.length}:${s.sessionId ?? ''}`)
    .join('|')
}

// Status anterior de cada conversa, para saber o que mudou desde a última olhada.
export class StatusChanges {
  private previous = new Map<string, Status>()

  // Conversas cujo status mudou (ou que apareceram agora, sem `before`).
  next(entries: ChatEntry[]): { entry: ChatEntry; before?: Status }[] {
    const seen = new Set<string>()
    const changed: { entry: ChatEntry; before?: Status }[] = []
    for (const entry of entries) {
      seen.add(entry.id)
      const before = this.previous.get(entry.id)
      this.previous.set(entry.id, entry.state.status)
      if (before !== entry.state.status) changed.push({ entry, before })
    }
    for (const id of this.previous.keys()) if (!seen.has(id)) this.previous.delete(id)
    return changed
  }
}

// Conversas trabalhando ou esperando você, para o indicador no canto do canvas. Parada com algo
// ainda rodando em segundo plano também conta como rodando.
export function activeChats(entries: ChatEntry[]): ActiveChat[] {
  return entries.flatMap(({ id, cwd, state: s }) => {
    const background = s.agents.filter((a) => a.background).length + s.backgroundTasks
    if (s.status === 'idle' && !background) return []
    return [
      {
        key: id,
        cwd,
        sessionId: s.sessionId,
        status: s.status === 'idle' ? 'running' : s.status,
        activity: s.status === 'idle' ? undefined : s.activity,
        foregroundAgents: s.agents.filter((a) => !a.background).length,
        background,
        turnStartedAt: s.status === 'idle' ? undefined : s.turnStartedAt
      }
    ]
  })
}

// Resumo do que o indicador mostra: o texto chegando não muda nada disso, e quem compara sai cedo.
export function activeSignature(chats: ActiveChat[]): string {
  return chats
    .map((c) => [c.key, c.sessionId, c.status, c.activity?.kind, c.activity?.tool, c.foregroundAgents, c.background, c.turnStartedAt].join(':'))
    .join('|')
}
