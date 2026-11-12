import type { Page } from '../ipc/page'
import { sendTo } from '../ipc/events'
import { PageMap } from './pages'

// Quem vê cada terminal: as páginas que pediram para abri-lo (terminal:open). A saída vai só para
// elas, em vez de para todas as janelas. A página que fecha ou recarrega sai da lista; a nova pede o
// terminal de novo ao montar.
export class TerminalViewers {
  // página → chaves dos terminais que ela abriu
  private pages = new PageMap<Set<string>>()

  add(wc: Page, key: string): void {
    const keys = this.pages.get(wc) ?? new Set<string>()
    keys.add(key)
    this.pages.set(wc, keys)
  }

  data(key: string, data: string): void {
    for (const [wc, keys] of this.pages.entries()) if (keys.has(key)) sendTo(wc, 'terminal:data', key, data)
  }

  // O tamanho do processo mudou (ou o dono): cada página sabe se é ela quem manda (ver TerminalSizes).
  size(key: string, cols: number, rows: number, owner: Page | null): void {
    for (const [page, keys] of this.pages.entries()) if (keys.has(key)) sendTo(page, 'terminal:size', key, cols, rows, page === owner)
  }

  exit(key: string, code: number): void {
    for (const [wc, keys] of this.pages.entries()) if (keys.has(key)) sendTo(wc, 'terminal:exit', key, code)
  }
}
