// O fim da saída de um processo, até `limit` caracteres. Guarda os pedaços como chegam e só junta
// quando alguém pede o texto: somar e cortar a cada pedaço copiava o limite inteiro a cada vez.
export class OutputBuffer {
  private chunks: string[] = []
  private head = 0
  private size = 0

  constructor(private readonly limit: number) {}

  push(data: string): void {
    if (!data) return
    this.chunks.push(data)
    this.size += data.length
    // Solta os pedaços mais velhos que já não entram no fim guardado.
    while (this.size - this.chunks[this.head].length >= this.limit) {
      this.size -= this.chunks[this.head].length
      this.head++
    }
    // Arruma a lista de vez em quando, em vez de a cada pedaço.
    if (this.head > 1024 && this.head * 2 > this.chunks.length) {
      this.chunks = this.chunks.slice(this.head)
      this.head = 0
    }
  }

  text(): string {
    const all = this.chunks.slice(this.head).join('')
    return all.length > this.limit ? all.slice(-this.limit) : all
  }
}
