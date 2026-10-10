// Imagens enviadas numa mensagem: lê (miniaturas) e abre o preview grande numa delas.
export type ImageView = { load: () => Promise<string[]>; open: (index: number) => void }

type Read = (messageId: string) => Promise<string[]>

// Leituras guardadas: a miniatura e o preview grande usam a mesma. Só as últimas ficam (as que
// saíram são lidas de novo se voltarem): conversa longa com muitos prints não segura todas na
// memória.
const KEEP = 30

// Um objeto por mensagem, sempre o mesmo: o balão memorizado não redesenha e a miniatura não refaz
// o observador. Quem lê as imagens gravadas muda com a conversa (setReader); a mensagem ainda a
// caminho traz a sua leitura própria (as imagens que estão no envio).
export function createImageViews(open: (load: () => Promise<string[]>, start: number) => void) {
  let read: Read | undefined
  const views = new Map<string, ImageView>()
  const cache = new Map<string, Promise<string[]>>()

  const cached = (id: string): Promise<string[]> => {
    let p = cache.get(id)
    if (p) cache.delete(id)
    else p = (read ? read(id) : Promise.resolve([])).catch(() => [])
    cache.set(id, p)
    if (cache.size > KEEP) cache.delete(cache.keys().next().value as string)
    return p
  }

  return {
    setReader(next: Read | undefined): void {
      read = next
    },
    viewFor(id: string, own?: () => Promise<string[]>): ImageView {
      let view = views.get(id)
      if (!view) {
        const load = own ?? (() => cached(id))
        view = { load, open: (start) => open(load, start) }
        views.set(id, view)
      }
      return view
    }
  }
}
