import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import type { CanvasToolCall, CanvasToolResult } from '../../shared/canvasAgent'
import { sendTo } from '../ipc/events'

// A janela do canvas tem esse tempo para executar a ação (inclui escolher pasta no seletor).
const CALL_TIMEOUT_MS = 3 * 60_000

type Pending = { wc: WebContents; finish: (r: CanvasToolResult) => void }
type Navigation = { isMainFrame: boolean; isSameDocument: boolean }

// Ações que o assistente pediu à janela do canvas e ainda esperam resposta. Nenhuma fica sem
// fim: a janela que fecha ou recarrega, o tempo esgotado e o "parar" respondem por ela.
export class PendingCalls {
  private pending = new Map<string, Pending>()
  // Janelas que já avisam quando fecham ou recarregam (um ouvinte por janela, não por ação: o
  // Claude pode pedir várias ações de uma vez).
  private watched = new WeakSet<WebContents>()

  constructor(private target: () => WebContents | null) {}

  // Pede à janela do canvas para executar a ação e espera a resposta.
  call(name: string, args: Record<string, unknown>): Promise<CanvasToolResult> {
    const wc = this.target()
    if (!wc || wc.isDestroyed()) return Promise.resolve({ id: '', text: 'O canvas não está aberto.', error: true })
    this.watch(wc)
    const call: CanvasToolCall = { id: randomUUID(), name, args }
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.cancel(call.id, 'O canvas não respondeu a tempo.'), CALL_TIMEOUT_MS)
      this.pending.set(call.id, {
        wc,
        finish: (r) => {
          clearTimeout(timer)
          this.pending.delete(call.id)
          resolve(r)
        }
      })
      sendTo(wc, 'canvasAgent:call', call)
    })
  }

  // Resposta da janela.
  settle(r: CanvasToolResult): void {
    if (typeof r?.id === 'string') this.pending.get(r.id)?.finish(r)
  }

  cancelAll(text: string): void {
    for (const id of [...this.pending.keys()]) this.cancel(id, text)
  }

  // Janela fechada ou recarregada: a página que ia responder não existe mais.
  private watch(wc: WebContents): void {
    if (this.watched.has(wc)) return
    this.watched.add(wc)
    const gone = () => {
      for (const [id, p] of [...this.pending]) {
        if (p.wc === wc) this.cancel(id, 'O canvas foi fechado ou recarregado antes de terminar.', false)
      }
    }
    wc.once('destroyed', gone)
    wc.on('did-start-navigation', (details: Navigation) => {
      if (details.isMainFrame && !details.isSameDocument) gone()
    })
  }

  // Responde no lugar da janela e avisa a ela para não executar mais: o seletor de pasta do
  // sistema pode continuar aberto, e o que for escolhido depois não deve entrar no canvas.
  private cancel(id: string, text: string, tell = true): void {
    const p = this.pending.get(id)
    if (!p) return
    p.finish({ id, text, error: true })
    if (tell) sendTo(p.wc, 'canvasAgent:cancel', id)
  }
}
