// Saída do app: pergunta antes se há algo rodando, encerra tudo uma vez só e, no Windows, espera os
// terminais fecharem. Sem Electron (quem liga aos eventos é o lifecycle.ts), para dar para testar.

// Fases, na ordem em que acontecem. Uma fase só no lugar dos seis booleanos soltos de antes
// (quitting, quitConfirmed, asking, draining, drained, checkingShells).
export type QuitPhase =
  | 'running' // aberto, nada pedido
  | 'checking' // Windows: conferindo se algum shell dos terminais roda um comando
  | 'asking' // a pergunta "Fechar mesmo assim?" está aberta
  | 'confirmed' // pode fechar sem perguntar (sim na pergunta, teste de fumaça, atualização)
  | 'closing' // tudo encerrado: as janelas fecham e o app sai
  | 'draining' // Windows: tudo encerrado, esperando os terminais terminarem de fechar
  | 'drained' // terminais fechados: a próxima saída passa direto

export type QuitHost = {
  // Conversas e terminais trabalhando, para a pergunta.
  inProgress(): string[]
  // Windows: há shell aberto para conferir (leva um instante).
  hasShells(): boolean
  busyShells(): Promise<string[]>
  ask(update: boolean, items: string[]): Promise<boolean>
  shutdown(install: boolean): void
  // Windows: o kill do node-pty fecha o terminal aos poucos (ver Terminals.closed).
  terminalsClosing(): boolean
  terminalsClosed(): Promise<void>
  hideWindows(): void
  quit(): void
  exit(): void
  updatePending(): boolean
  // Responde quando o programa da troca (ou o instalador) abriu de fato: false se não abriu.
  install(relaunch: boolean): Promise<boolean>
}

type QuitEvent = { preventDefault(): void }

export class QuitFlow {
  private phase: QuitPhase = 'running'
  // A pergunta aberta: ⌘Q repetido com ela na tela não abre outra.
  private question: Promise<boolean> | null = null

  constructor(private host: QuitHost) {}

  get current(): QuitPhase {
    return this.phase
  }

  // O app está fechando de verdade: as janelas do canvas já podem fechar.
  get quitting(): boolean {
    return this.phase === 'closing' || this.phase === 'draining' || this.phase === 'drained'
  }

  // before-quit. Decidido na hora: adiar a saída sem motivo faria o macOS acusar o Argus de travar
  // o desligamento. No Windows, saber se o shell de um terminal está rodando algo leva um instante;
  // com terminal aberto, a saída espera essa conferência.
  beforeQuit(e: QuitEvent): void {
    if (this.phase === 'drained') return
    // Fechar de novo enquanto os terminais fecham não repete o shutdown.
    if (this.phase === 'draining') return e.preventDefault()
    const decided = this.phase === 'confirmed' || this.quitting
    const items = decided ? [] : this.host.inProgress()
    const checkShells = !decided && this.host.hasShells()
    if (!items.length && !checkShells) return this.finish(e)
    e.preventDefault()
    // Fechar de novo enquanto a conferência roda ou a pergunta está aberta não abre outra.
    if (this.phase === 'checking' || this.phase === 'asking') return
    this.askThenQuit(items, checkShells).catch((err: unknown) => console.error('[saída] não deu para conferir:', err))
  }

  // Teste de fumaça: sai pelo mesmo caminho de quem fecha a janela, já confirmado.
  confirmAndQuit(): void {
    this.confirmed()
    this.host.quit()
  }

  // Só troca o app depois do sim: o script da troca reabre o Argus assim que o processo sai.
  async restartToUpdate(): Promise<void> {
    const items = [...this.host.inProgress(), ...(await this.host.busyShells())]
    if (!this.host.updatePending() || (items.length && !(await this.confirm(true, items)))) return
    this.confirmed()
    // Não deu para começar a troca (nem depois de abrir: o instalador do Windows apagado por um
    // antivírus, por exemplo): o app não fecha, e a próxima saída pergunta de novo.
    if (!(await this.host.install(true)) && this.phase === 'confirmed') this.phase = 'running'
  }

  // Sinais do modo de desenvolvimento: sai na hora, depois de os terminais fecharem. Um segundo
  // sinal no meio disso não repete o shutdown.
  exitNow(): void {
    if (this.phase === 'draining' || this.phase === 'drained') return
    this.shutdown(true)
    if (!this.host.terminalsClosing()) return this.host.exit()
    this.phase = 'draining'
    void this.host.terminalsClosed().then(() => this.host.exit())
  }

  // Windows desligando ou saindo da conta: o before-quit não vem, e o sistema encerra o app logo em
  // seguida. Guarda e encerra o que dá, sem abrir o instalador de uma atualização: cortado no meio
  // pelo desligamento, ele deixaria o app pela metade.
  sessionEnd(): void {
    this.shutdown(false)
  }

  // Encerra tudo uma vez só, venha de onde vier (⌘Q, sinal, desligamento do Windows).
  private shutdown(install: boolean): void {
    if (this.quitting) return
    this.phase = 'closing'
    this.host.shutdown(install)
  }

  private async askThenQuit(items: string[], checkShells: boolean): Promise<void> {
    let all = items
    if (checkShells) {
      this.phase = 'checking'
      try {
        all = [...items, ...(await this.host.busyShells())]
      } finally {
        // Mesmo se a conferência falhar: a próxima saída tenta de novo, em vez de ficar presa.
        if (this.phase === 'checking') this.phase = 'running'
      }
    }
    if (all.length && !(await this.confirm(false, all))) return
    this.confirmed()
    this.host.quit()
  }

  private confirm(update: boolean, items: string[]): Promise<boolean> {
    if (!this.question) {
      // Uma saída já confirmada (a atualização esperando o instalador abrir) continua confirmada.
      if (this.phase === 'running' || this.phase === 'checking') this.phase = 'asking'
      // A pergunta que falha conta como "Cancelar": o app segue aberto e pergunta de novo.
      this.question = this.host
        .ask(update, items)
        .catch((err: unknown) => {
          console.error('[saída] a pergunta de fechar falhou:', err)
          return false
        })
        .finally(() => (this.question = null))
    }
    return this.question.then((yes) => {
      if (!yes && this.phase === 'asking') this.phase = 'running'
      return yes
    })
  }

  // Saída confirmada, se o app ainda não começou a fechar (depois disso, nada volta atrás).
  private confirmed(): void {
    if (!this.quitting) this.phase = 'confirmed'
  }

  // Depois do shutdown, `closing` (ou `draining`, no Windows) segue até o app sair.
  private finish(e: QuitEvent): void {
    this.shutdown(true)
    if (!this.host.terminalsClosing()) return
    e.preventDefault()
    this.phase = 'draining'
    this.host.hideWindows()
    void this.host.terminalsClosed().then(() => {
      this.phase = 'drained'
      this.host.quit()
    })
  }
}
