import { ShellMarks, type ShellMark } from './shellMarks'

// O que acontece no shell do drawer, para o Claude saber quando o comando dele terminou e se a pessoa
// mexeu no terminal depois (ver drawerShells.ts): a saída, as marcas da integração (shellMarks.ts) e o
// que a pessoa digita.

// Marcas guardadas: as do comando em andamento e um pouco de folga.
const MARKS_KEPT = 64

// Respostas que o próprio xterm da tela manda ao shell, sem ninguém digitar: posição do cursor,
// identificação do terminal, estado, modos, foco e as respostas em OSC e DCS (cores, versão).
const TERMINAL_REPORTS = /\x1b\[(?:\d+;\d+R|[?>][\d;]*c|\d*n|\?[\d;]*\$y|[IO])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1bP[^\x1b]*\x1b\\/g

export const isPersonInput = (data: string): boolean => data.replace(TERMINAL_REPORTS, '').length > 0

// Comando que o Claude rodou: onde estava a saída quando ele apertou Enter, e quando. personCut: onde
// ela estava quando a pessoa digitou pela primeira vez depois dele; dali em diante a saída pode ser
// dela, e ler pede permissão (ver drawerShells.ts).
export type AgentCommand = { offset: number; at: number; personCut?: number }

export type ShellPhase = 'starting' | 'prompt' | 'running'

export class ShellActivity {
  private readonly parser: ShellMarks | null
  private marks: ShellMark[] = []
  private seenMark = false
  private waiters = new Set<() => void>()
  // Quando chegou a última saída, quando apareceu o último prompt marcado e quando a pessoa digitou
  // pela última vez (Date.now()).
  outputAt = 0
  promptAt = 0
  personAt = 0
  agent: AgentCommand | null = null
  closed = false
  readonly startedAt = Date.now()

  // nonce: o da integração do shell (ver shellIntegration.ts); sem ele, o shell não marca nada.
  constructor(nonce?: string) {
    this.parser = nonce ? new ShellMarks(nonce) : null
  }

  // As marcas valem: a integração subiu (já marcou um prompt) e ninguém imprimiu o nonce.
  get marked(): boolean {
    return this.seenMark && !this.parser?.distrusted
  }

  // A integração foi pedida e ainda pode marcar (o primeiro prompt pode não ter chegado).
  get integrated(): boolean {
    return !!this.parser && !this.parser.distrusted
  }

  // Pela última marca: no prompt (A ou D) ou com um comando rodando (C).
  get phase(): ShellPhase {
    const last = this.marks.at(-1)
    if (!this.marked || !last) return 'starting'
    return last.kind === 'C' ? 'running' : 'prompt'
  }

  output(data: string, start: number): void {
    const now = Date.now()
    this.outputAt = now
    for (const mark of this.parser?.feed(data, start) ?? []) {
      this.seenMark = true
      if (mark.kind === 'A') this.promptAt = now
      this.marks.push(mark)
    }
    if (this.marks.length > MARKS_KEPT) this.marks.splice(0, this.marks.length - MARKS_KEPT)
    this.wake()
  }

  // end: onde a saída do terminal estava quando a pessoa digitou.
  person(data: string, end: number): void {
    if (!isPersonInput(data)) return
    this.personAt = Date.now()
    if (this.agent && this.agent.personCut === undefined) this.agent.personCut = end
    this.wake()
  }

  exited(): void {
    this.closed = true
    this.wake()
  }

  // A primeira marca do tipo a partir de uma posição da saída.
  markAfter(kind: ShellMark['kind'], offset: number): ShellMark | undefined {
    return this.marked ? this.marks.find((m) => m.kind === kind && m.start >= offset) : undefined
  }

  // Espera a próxima novidade (saída, marca, tecla da pessoa, fim do shell) ou o prazo.
  next(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve()
      const done = () => {
        clearTimeout(timer)
        this.waiters.delete(done)
        signal?.removeEventListener('abort', done)
        resolve()
      }
      const timer = setTimeout(done, Math.max(0, ms))
      this.waiters.add(done)
      signal?.addEventListener('abort', done)
    })
  }

  private wake(): void {
    for (const done of [...this.waiters]) done()
  }
}
