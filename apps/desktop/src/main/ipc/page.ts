import type { WebContents } from 'electron';

// Quem conversa com o processo principal: uma janela do app (o webContents dela) ou uma janela de
// outro Argus ligada por acesso remoto (RemotePage, em src/main/remote/remotePage.ts). Os dois
// recebem avisos, abrem terminais e seguram conversas do mesmo jeito; o que só existe numa janela
// de verdade (diálogo do sistema, zoom, mascote) pede o webContents com `contentsOf`.

export type PageEvent = 'did-navigate' | 'render-process-gone' | 'destroyed';

export interface Page {
  readonly id: number
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
  on(event: PageEvent, listener: () => void): this
  once(event: PageEvent, listener: () => void): this
  off(event: PageEvent, listener: () => void): this
}

// Quem chamou um canal (o primeiro argumento dos handlers em src/main/ipc/register.ts).
export interface Caller {
  readonly sender: Page
}

// Marca das páginas remotas: sem importar a classe, que depende deste arquivo.
export const REMOTE_PAGE = Symbol('remotePage');

export function isRemotePage(page: Page): boolean {
  return REMOTE_PAGE in page;
}

// O webContents de uma janela de verdade; nulo para a página de outro Argus.
export function contentsOf(page: Page): WebContents | null {
  return isRemotePage(page) ? null : (page as WebContents);
}
