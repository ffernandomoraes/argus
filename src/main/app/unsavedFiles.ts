import type { WebContents } from 'electron'
import { PageMap } from './pages'

// Páginas com arquivo alterado e não salvo no painel de código. Os rascunhos só existem na memória
// da janela: fechar ou atualizar o app os perde, então a pergunta de fechar conta com eles. A página
// que recarrega ou fecha sai da lista sozinha (o rascunho dela já se perdeu).
export class UnsavedFiles {
  private pages = new PageMap<true>()

  set(wc: WebContents, has: boolean): void {
    if (has) this.pages.set(wc, true)
    else this.pages.delete(wc)
  }

  any(): boolean {
    return this.pages.values().length > 0
  }
}
