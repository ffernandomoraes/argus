import type { Event, WebContents, WebContentsDidStartNavigationEventParams } from 'electron'

// Fechar, recarregar ou derrubar a janela dona encerra o ditado dela: o microfone (no Mac, o
// programa que grava) e a conexão não podem seguir ligados sem ninguém ouvindo. Navegação dentro
// da própria página (o # da rota) não conta. Devolve a função que para de vigiar.
export function watchWindow(target: WebContents, onGone: () => void): () => void {
  const navigated = (details: Event<WebContentsDidStartNavigationEventParams>) => {
    if (details.isMainFrame && !details.isSameDocument) onGone()
  }
  target.once('destroyed', onGone)
  target.on('render-process-gone', onGone)
  target.on('did-start-navigation', navigated)
  return () => {
    if (target.isDestroyed()) return
    target.off('destroyed', onGone)
    target.off('render-process-gone', onGone)
    target.off('did-start-navigation', navigated)
  }
}
