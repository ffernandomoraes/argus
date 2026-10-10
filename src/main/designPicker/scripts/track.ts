// Endereço da página: a cada navegação dentro dela (link, history.pushState de app React, voltar),
// avisa o drawer, que mostra o caminho no campo de endereço. Avisa também os links da página para
// outras páginas do mesmo servidor (menus), que entram na lista do campo. Página carregada de novo
// perde o script; o drawer põe de novo a cada carga.
// Muito app chama replaceState sem mudar o endereço (a cada rolagem, a cada filtro digitado): só
// avisa quando o caminho (ou o título) mudou. Os links: no máximo os 300 primeiros da página e 200
// caminhos, para uma página com milhares de links (uma tabela) não pesar.
export const TRACK = `(() => {
  if (window.__argusTrack) return
  window.__argusTrack = true
  const links = () => {
    const paths = new Set()
    const anchors = document.querySelectorAll('a[href]')
    for (let i = 0; i < anchors.length && i < 300; i++) {
      try {
        const u = new URL(anchors[i].getAttribute('href'), location.href)
        if (u.origin === location.origin) paths.add(u.pathname)
      } catch (e) {}
      if (paths.size >= 200) break
    }
    parent.postMessage({ argus: 'links', paths: Array.from(paths) }, '*')
  }
  let last = ''
  let linksTimer = 0
  const send = (force) => {
    const path = location.pathname + location.search + location.hash
    const key = path + '\\n' + document.title
    if (!force && key === last) return
    last = key
    parent.postMessage({ argus: 'location', path, title: document.title }, '*')
    // App React monta o menu depois de mudar o endereço: espera um pouco.
    clearTimeout(linksTimer)
    linksTimer = setTimeout(links, 800)
  }
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name]
    history[name] = function (...args) {
      const result = original.apply(this, args)
      send(false)
      return result
    }
  }
  // Windows (sem menu): Ctrl+R dado dentro da página não chega ao app; ela avisa, e o drawer
  // recarrega só a página. No Mac, o ⌘R passa pelo menu do app.
  if (!/Mac/.test(navigator.platform)) {
    addEventListener('keydown', (e) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'r') return
      e.preventDefault()
      parent.postMessage({ argus: 'reload' }, '*')
    }, true)
  }
  addEventListener('popstate', () => send(false))
  addEventListener('hashchange', () => send(false))
  send(true)
})()`
