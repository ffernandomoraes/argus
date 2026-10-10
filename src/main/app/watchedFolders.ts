import type { WebContents } from 'electron'
import { PageMap } from './pages'

// Pastas vigiadas por página: cada janela manda as dela (o canvas, as pastas na tela; a janela de
// uma conversa, só a pasta dela). O vigia segue a união; a janela que fecha ou recarrega sai da
// conta. Antes a última janela a avisar trocava a lista inteira, e abrir uma conversa em janela
// separada desligava o tempo real das outras pastas do canvas.
export class WatchedFolders {
  private pages: PageMap<string[]>

  constructor(private apply: (paths: string[]) => void) {
    this.pages = new PageMap<string[]>(() => this.update())
  }

  set(wc: WebContents, paths: string[]): void {
    this.pages.set(wc, paths)
    this.update()
  }

  private update(): void {
    this.apply([...new Set(this.pages.values().flat())])
  }
}
