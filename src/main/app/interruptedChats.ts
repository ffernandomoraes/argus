import type { InterruptedChat, InterruptReason } from '../../shared/chat'
import type { ChatEntry } from '../chats/entries'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'

// Conversas que o Argus fechou no meio (atualização, ⌘Q, queda do app): ao abrir de novo, aparecem
// interrompidas, com o botão de continuar de onde pararam. Também as que o sistema encerrou sem
// memória no meio de uma resposta (ver mark). As que estão trabalhando vão para o arquivo quando
// começam e saem quando param: a marca sobrevive também a uma queda, que não passa pela saída do app.

type Saved = { interrupted: InterruptedChat[]; running: InterruptedChat[] }

// Só as mais recentes: as antigas (conversa apagada, nunca continuada) saem.
const MAX = 50

// Como a pergunta de fechar conta "em andamento" (ver closeQuestion.ts).
const busy = (e: ChatEntry) => e.state.status !== 'idle' || e.state.agents.length > 0

function valid(list: unknown): InterruptedChat[] {
  if (!Array.isArray(list)) return []
  return list.flatMap((c: Partial<InterruptedChat> | null) =>
    typeof c?.sessionId === 'string' && typeof c.cwd === 'string'
      ? [{ sessionId: c.sessionId, cwd: c.cwd, ...(c.reason === 'memory' && { reason: c.reason }) }]
      : []
  )
}

function read(file: string): Saved {
  const r = readJsonFile<Partial<Saved>>(file)
  const data = r.status === 'ok' && r.data && typeof r.data === 'object' ? r.data : {}
  return { interrupted: valid(data.interrupted), running: valid(data.running) }
}

// Sem repetir a conversa: a mais nova fica no fim.
function joined(a: InterruptedChat[], b: InterruptedChat[]): InterruptedChat[] {
  const ids = new Set(b.map((c) => c.sessionId))
  return [...a.filter((c) => !ids.has(c.sessionId)), ...b].slice(-MAX)
}

const idsOf = (list: InterruptedChat[]) => list.map((c) => c.sessionId).join('|')

export class InterruptedChats {
  private interrupted: InterruptedChat[]
  private running: InterruptedChat[] = []
  // O app está fechando: as conversas param porque ele as encerra, e o que estava trabalhando
  // continua no arquivo para a próxima abertura.
  private frozen = false

  constructor(
    private file: string,
    private onChange: () => void
  ) {
    const saved = read(file)
    // O que trabalhava quando o app fechou da última vez foi interrompido.
    this.interrupted = joined(saved.interrupted, saved.running)
    if (saved.running.length) this.save()
  }

  list(): InterruptedChat[] {
    return this.interrupted
  }

  // A cada mudança de estado de uma conversa. Grava só quando muda quem está trabalhando.
  update(entries: ChatEntry[]): void {
    if (this.frozen) return
    const running = entries.flatMap((e) => (busy(e) && e.state.sessionId ? [{ sessionId: e.state.sessionId, cwd: e.cwd }] : []))
    // Voltou a trabalhar (continuar, mensagem nova): não está mais interrompida.
    const ids = new Set(running.map((c) => c.sessionId))
    const resumed = this.interrupted.some((c) => ids.has(c.sessionId))
    if (!resumed && idsOf(running) === idsOf(this.running)) return
    if (resumed) this.interrupted = this.interrupted.filter((c) => !ids.has(c.sessionId))
    this.running = running
    this.save()
    if (resumed) this.onChange()
  }

  // Parou no meio sem o app fechar (o sistema encerrou o Claude por falta de memória): marcada do
  // mesmo jeito, com o motivo.
  mark(sessionId: string, cwd: string, reason: InterruptReason): void {
    this.interrupted = joined(this.interrupted, [{ sessionId, cwd, reason }])
    this.save()
    this.onChange()
  }

  // O X do aviso na conversa.
  dismiss(sessionId: string): void {
    if (!this.interrupted.some((c) => c.sessionId === sessionId)) return
    this.interrupted = this.interrupted.filter((c) => c.sessionId !== sessionId)
    this.save()
    this.onChange()
  }

  // Antes de encerrar as conversas, na saída do app.
  freeze(): void {
    this.frozen = true
  }

  private save(): void {
    try {
      writeJsonAtomicSync(this.file, { interrupted: this.interrupted, running: this.running })
    } catch {
      // Sem gravar, a marca vale só até fechar o app.
    }
  }
}
