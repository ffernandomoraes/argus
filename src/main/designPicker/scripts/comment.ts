import { CLUES } from './clues'

// Comentários na página: ligado, o clique não chega à página; marca o ponto e manda ao drawer o
// elemento clicado (com as pistas para achá-lo no código). O balão é do drawer, desenhado por cima
// da página: daqui vai só a posição de cada ponto, de novo a cada rolagem (inclusive de uma área
// interna) e a cada pouco, para acompanhar a página que muda (só quando algum ponto mudou). Cada
// ponto fica preso ao elemento, na mesma distância do canto dele.
// Os ids começam num número único: a página recarrega no fim de todo pedido, e recomeçar do 1
// colidiria com os comentários que o drawer ainda guarda. Comentário só nasce com o modo ligado e
// de um clique da pessoa (um el.click() do próprio código da página não cria), com cada texto
// cortado num tamanho razoável.
export const COMMENT = `(() => {
  const w = window
  if (w.__argusComment) return
${CLUES}
  const anchors = new Map()
  let nextId = Date.now()
  let active = false
  let frame = 0
  let lastPos = ''
  const cap = (s, n) => (s.length > n ? s.slice(0, n) : s)
  const style = document.createElement('style')
  style.textContent = '*, *::before, *::after { cursor: crosshair !important }'
  const report = () => {
    frame = 0
    const pos = {}
    anchors.forEach((a, id) => {
      if (!a.el.isConnected) return void (pos[id] = null)
      const r = a.el.getBoundingClientRect()
      const x = r.left + Math.min(a.dx, r.width)
      const y = r.top + Math.min(a.dy, r.height)
      pos[id] = [x, y, x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight]
    })
    const json = JSON.stringify(pos)
    if (json === lastPos) return
    lastPos = json
    parent.postMessage({ argus: 'comment-pos', pos }, '*')
  }
  const schedule = () => {
    if (!frame && anchors.size) frame = requestAnimationFrame(report)
  }
  const swallow = (e) => {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }
  const click = (e) => {
    if (active !== true) return
    swallow(e)
    if (!e.isTrusted) return
    const target = e.target instanceof Element ? e.target : null
    if (!target) return
    const el = target.closest(ELEMENT) || target
    const r = el.getBoundingClientRect()
    const id = nextId++
    anchors.set(id, { el, dx: e.clientX - r.left, dy: e.clientY - r.top })
    parent.postMessage({
      argus: 'comment-add',
      id,
      x: e.clientX,
      y: e.clientY,
      name: cap(elementName(el), 40),
      text: cap(text(el), 400),
      html: cap(el.outerHTML, 3000),
      path: cap(pathOf(el), 1000),
      source: cap(sourceOf(el), 1000)
    }, '*')
  }
  for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick']) addEventListener(t, swallow, true)
  addEventListener('click', click, true)
  addEventListener('scroll', schedule, true)
  addEventListener('resize', schedule)
  setInterval(schedule, 500)
  w.__argusComment = {
    on(v) {
      active = v === true
      if (active) document.head.appendChild(style)
      else style.remove()
    },
    remove(id) {
      anchors.delete(id)
      schedule()
    },
    clear() {
      anchors.clear()
    }
  }
})()`
