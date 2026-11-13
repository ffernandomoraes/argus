import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

// Fila que alimenta a sessão: cada envio do chat vira uma mensagem para o Claude.
export class Inbox implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = []
  private wake: (() => void) | null = null
  private closed = false

  push(item: SDKUserMessage): void {
    this.items.push(item)
    this.wake?.()
  }

  close(): void {
    this.closed = true
    this.wake?.()
  }

  async *[Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    while (true) {
      if (this.items.length) yield this.items.shift()!
      else if (this.closed) return
      else await new Promise<void>((r) => (this.wake = r))
    }
  }
}
