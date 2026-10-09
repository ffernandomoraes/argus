import type { WebContents } from 'electron'

// Só o servidor local do projeto: o seletor não entra em nenhuma outra página.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

// Escolher uma parte da página do protótipo, como o seletor de elementos do navegador: a seção
// marcada (data-secao) ou, sem marcação, o primeiro bloco de bom tamanho acima do ponteiro. Como
// no Figma, o clique dentro da seção escolhida entra nela: campo, botão, texto... O clique não
// chega à página; cada escolha vai para o drawer por postMessage, e o seletor fica ligado até o
// drawer mandar parar (ESC volta do elemento para a seção). Roda dentro da página, por isso é texto.
const start = (accent: string) => `(() => {
  const w = window
  if (w.__argusPick) w.__argusPick.stop()
  const accent = '${accent}'
  // Dois contornos: o que segue o ponteiro e o da parte escolhida.
  const outline = (solid) => {
    const box = document.createElement('div')
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;box-sizing:border-box;border-radius:4px;display:none;border:2px ' + (solid ? 'solid ' + accent + ';background:' + accent + '1a' : 'dashed ' + accent)
    const tag = document.createElement('div')
    tag.style.cssText = 'position:absolute;left:-2px;padding:2px 7px;border-radius:4px;background:' + accent + ';color:#fff;font:600 12px/16px -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;white-space:nowrap'
    box.appendChild(tag)
    document.documentElement.appendChild(box)
    return { box, tag, el: null }
  }
  const hover = outline(false)
  const picked = outline(true)
  const ELEMENTS = [
    ['button, [role=button], input[type=button], input[type=submit]', 'Botão'],
    ['input, select, textarea, [role=textbox], [role=combobox]', 'Campo'],
    ['[role=checkbox], [role=switch], [role=radio]', 'Opção'],
    ['a, [role=link]', 'Link'],
    ['label', 'Rótulo'],
    ['h1, h2, h3, h4, h5, h6', 'Título'],
    ['img, svg, picture, video', 'Imagem'],
    ['p, li, td, th, small, blockquote', 'Texto'],
    ['[role=tab]', 'Aba']
  ]
  const ELEMENT = ELEMENTS.map((e) => e[0]).join(', ')
  // Seção escolhida: dentro dela, o ponteiro acende os elementos.
  let section = null
  const within = (el) => section && section.isConnected && section.contains(el)
  const elementName = (el) => (ELEMENTS.find((e) => el.matches(e[0])) || [0, el.tagName.toLowerCase()])[1]
  const sectionName = (el) => el.getAttribute('data-secao') || el.tagName.toLowerCase()
  const name = (el) => (within(el) && el !== section ? elementName(el) : sectionName(el))
  const target = (el) => {
    if (!(el instanceof Element)) return null
    if (within(el)) {
      const found = el.closest(ELEMENT)
      return found && found !== section && section.contains(found) ? found : section
    }
    const marked = el.closest('[data-secao]')
    if (marked) return marked
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const r = n.getBoundingClientRect()
      if (r.width >= Math.min(320, innerWidth * 0.3) && r.height >= 48) return n
    }
    return el
  }
  const place = (o) => {
    if (!o.el || !o.el.isConnected) return void (o.box.style.display = 'none')
    const r = o.el.getBoundingClientRect()
    o.box.style.display = 'block'
    o.box.style.left = r.left + 'px'
    o.box.style.top = r.top + 'px'
    o.box.style.width = r.width + 'px'
    o.box.style.height = r.height + 'px'
    o.tag.textContent = name(o.el)
    o.tag.style.top = r.top < 22 ? '2px' : '-22px'
  }
  const placeAll = () => {
    place(picked)
    // Em cima da parte escolhida, só o contorno dela.
    if (hover.el === picked.el) hover.box.style.display = 'none'
    else place(hover)
  }
  const swallow = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 400)
  const choose = (el) => {
    picked.el = el
    placeAll()
    const inside = el !== section
    parent.postMessage({
      argus: 'pick',
      name: name(el),
      secao: section.getAttribute('data-secao'),
      section: inside ? sectionName(section) : null,
      text: text(el),
      html: el.outerHTML.slice(0, 4000)
    }, '*')
  }
  const move = (e) => {
    hover.el = target(e.target)
    placeAll()
  }
  const leave = () => {
    hover.el = null
    placeAll()
  }
  const click = (e) => {
    swallow(e)
    const el = target(e.target)
    if (!el) return
    // Fora da seção escolhida: ela vira a nova seção.
    if (!within(el)) section = el
    choose(el)
  }
  const key = (e) => {
    if (e.key !== 'Escape') return
    swallow(e)
    // Com um elemento escolhido, volta para a seção dele.
    if (section && section.isConnected && picked.el && picked.el !== section) return choose(section)
    w.__argusPick.stop()
    parent.postMessage({ argus: 'pick-cancel' }, '*')
  }
  const events = [['mousemove', move], ['click', click], ['mousedown', swallow], ['mouseup', swallow], ['pointerdown', swallow], ['pointerup', swallow], ['dblclick', swallow], ['keydown', key]]
  events.forEach(([t, f]) => addEventListener(t, f, true))
  document.addEventListener('mouseleave', leave)
  addEventListener('scroll', placeAll, true)
  addEventListener('resize', placeAll)
  w.__argusPick = {
    stop() {
      events.forEach(([t, f]) => removeEventListener(t, f, true))
      document.removeEventListener('mouseleave', leave)
      removeEventListener('scroll', placeAll, true)
      removeEventListener('resize', placeAll)
      hover.box.remove()
      picked.box.remove()
      delete w.__argusPick
    }
  }
})()`

const STOP = 'window.__argusPick && window.__argusPick.stop()'

// Visualizar: com o clique na página, o Esc fica nela e não chega ao Argus. Ligado, a página avisa
// o Esc ao drawer, que sai da visualização. Desligado, o Esc é só da página (fechar um modal dela).
const escape = (on: boolean): string => `(() => {
  window.__argusEscOn = ${on}
  if (window.__argusEsc) return
  window.__argusEsc = true
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.__argusEscOn) parent.postMessage({ argus: 'escape' }, '*')
  }, true)
})()`

export function escapeInPage(wc: WebContents, origin: string, on: boolean): void {
  inPage(wc, origin, escape(on))
}

// Endereço da página: a cada navegação dentro dela (link, history.pushState de app React, voltar),
// avisa o drawer, que mostra o caminho no campo de endereço. Página carregada de novo perde o
// script; o drawer põe de novo a cada carga.
const TRACK = `(() => {
  if (window.__argusTrack) return
  window.__argusTrack = true
  const send = () => parent.postMessage({ argus: 'location', path: location.pathname + location.search + location.hash }, '*')
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name]
    history[name] = function (...args) {
      const result = original.apply(this, args)
      send()
      return result
    }
  }
  addEventListener('popstate', send)
  addEventListener('hashchange', send)
  send()
})()`

export function trackInPage(wc: WebContents, origin: string): void {
  inPage(wc, origin, TRACK)
}

// Liga ou desliga o seletor na página do protótipo aberta no drawer desta janela.
export function pickInPage(wc: WebContents, origin: string, on: boolean, accent: string): void {
  const color = /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#0a84ff'
  inPage(wc, origin, on ? start(color) : STOP)
}

function inPage(wc: WebContents, origin: string, script: string): void {
  if (!LOCAL.test(origin)) return
  for (const frame of wc.mainFrame.framesInSubtree) {
    if (frame === wc.mainFrame) continue
    let frameOrigin = ''
    try {
      frameOrigin = new URL(frame.url).origin
    } catch {
      continue
    }
    if (frameOrigin === origin) void frame.executeJavaScript(script).catch(() => {})
  }
}
