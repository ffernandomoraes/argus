import type { ChatState } from '../../shared/chat'

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
