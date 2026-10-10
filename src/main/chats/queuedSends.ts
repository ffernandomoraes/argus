// Mensagens que você mandou com o Claude no meio de um pedido. O Claude Code guarda na fila dele e
// entrega entre uma ação e outra, ou num pedido logo depois deste. Enquanto alguma pode estar
// esperando, a sessão não fecha: fechar mataria a mensagem junto.

// Silêncio do Claude depois do fim do pedido: sem pedido novo nesse tempo, a mensagem já foi
// entregue dentro do pedido que acabou. Generoso porque o pedido seguinte só dá sinal quando a API
// começa a responder; qualquer notícia do Claude nesse meio-tempo (nova tentativa da API, hooks...)
// recomeça a conta.
const GRACE_MS = 30_000

export class QueuedSends {
  private ids = new Set<string>()
  private timer: NodeJS.Timeout | null = null
  private lastSeen = 0

  constructor(
    // A espera acabou sem pedido novo: a sessão pode ter ficado livre para fechar.
    private onDrained: () => void,
    private graceMs = GRACE_MS
  ) {}

  get size(): number {
    return this.ids.size
  }

  has(id: string): boolean {
    return this.ids.has(id)
  }

  add(id: string): void {
    this.ids.add(id)
  }

  // Começou um pedido novo: o que esperava na fila está nele.
  started(): void {
    this.clear()
  }

  // O pedido terminou com mensagem ainda na fila: espera o seguinte começar.
  ended(): void {
    if (!this.ids.size) return
    this.lastSeen = Date.now()
    if (!this.timer) this.wait(this.graceMs)
  }

  // Notícia do Claude enquanto espera.
  touch(): void {
    if (this.timer) this.lastSeen = Date.now()
  }

  clear(): void {
    this.ids.clear()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private wait(ms: number): void {
    this.timer = setTimeout(() => {
      const quiet = Date.now() - this.lastSeen
      if (quiet < this.graceMs) return this.wait(this.graceMs - quiet)
      this.clear()
      this.onDrained()
    }, ms)
  }
}
