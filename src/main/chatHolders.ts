import type { WebContents } from 'electron'

// Quem está com cada conversa aberta na tela. A mesma conversa pode aparecer em mais de uma janela
// (o canvas espelhado em outro monitor): a sessão só é solta quando a última janela solta.
// Janela fechada, recarregada (⌘R) ou com a página caída solta tudo o que tinha: a limpeza do React
// não chega a rodar nesses casos.
export class ChatHolders {
  // conversa → janela (id do webContents) → quantas vezes ela está aberta ali
  private holds = new Map<string, Map<number, number>>()
  private watched = new Set<number>()

  constructor(
    private retain: (key: string) => void,
    private release: (key: string) => void
  ) {}

  hold(key: string, wc: WebContents): void {
    const byWindow = this.holds.get(key) ?? new Map<number, number>()
    byWindow.set(wc.id, (byWindow.get(wc.id) ?? 0) + 1)
    this.holds.set(key, byWindow)
    this.watch(wc)
    this.retain(key)
  }

  drop(key: string, wcId: number): void {
    const byWindow = this.holds.get(key)
    const count = byWindow?.get(wcId)
    if (!byWindow || !count) return
    if (count > 1) byWindow.set(wcId, count - 1)
    else byWindow.delete(wcId)
    if (byWindow.size) return
    this.holds.delete(key)
    this.release(key)
  }

  private watch(wc: WebContents): void {
    if (this.watched.has(wc.id)) return
    const id = wc.id
    this.watched.add(id)
    // Página trocada (recarregar) ou caída: a nova pede de novo as conversas que mostrar. O
    // did-navigate só vem do quadro principal, com documento novo e já confirmado: a navegação
    // barrada pela trava (arquivo do Finder solto na janela) não solta nada.
    wc.on('did-navigate', () => this.dropAll(id))
    wc.on('render-process-gone', () => this.dropAll(id))
    wc.once('destroyed', () => {
      this.watched.delete(id)
      this.dropAll(id)
    })
  }

  // Solta tudo o que a janela segurava.
  private dropAll(wcId: number): void {
    for (const [key, byWindow] of [...this.holds]) {
      if (!byWindow.delete(wcId) || byWindow.size) continue
      this.holds.delete(key)
      this.release(key)
    }
  }
}
