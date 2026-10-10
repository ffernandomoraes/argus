import type { WebContents } from 'electron'

// O que uma página pediu (pastas vigiadas, terminais abertos, "canvas pronto") vale até ela acabar:
// a janela fechar, recarregar (o quadro principal abre outro documento) ou a página cair. A página
// nova pede de novo ao montar.
//
// Recarregar é medido no did-navigate (só o quadro principal, só documento novo, já confirmado): o
// iframe do modo design carregando não conta, nem uma navegação barrada pelas travas de segurança.
function onPageGone(wc: WebContents, cb: () => void): () => void {
  const gone = (): void => {
    stop()
    cb()
  }
  const stop = (): void => {
    wc.off('did-navigate', gone)
    wc.off('render-process-gone', gone)
    wc.off('destroyed', gone)
  }
  wc.on('did-navigate', gone)
  wc.on('render-process-gone', gone)
  wc.once('destroyed', gone)
  return stop
}

// Um valor por página, que some sozinho quando ela acaba (onDrop avisa).
export class PageMap<T> {
  private items = new Map<WebContents, { value: T; stop: () => void }>()

  constructor(private onDrop?: (wc: WebContents) => void) {}

  get(wc: WebContents): T | undefined {
    return this.items.get(wc)?.value
  }

  has(wc: WebContents): boolean {
    return this.items.has(wc)
  }

  set(wc: WebContents, value: T): void {
    const item = this.items.get(wc)
    if (item) {
      item.value = value
      return
    }
    const stop = onPageGone(wc, () => {
      this.items.delete(wc)
      this.onDrop?.(wc)
    })
    this.items.set(wc, { value, stop })
  }

  delete(wc: WebContents): void {
    const item = this.items.get(wc)
    if (!item) return
    item.stop()
    this.items.delete(wc)
  }

  entries(): [WebContents, T][] {
    return [...this.items].map(([wc, item]) => [wc, item.value])
  }

  values(): T[] {
    return [...this.items.values()].map((item) => item.value)
  }
}
