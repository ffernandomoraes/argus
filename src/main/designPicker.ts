import type { WebContents } from 'electron'

// Só o servidor local do projeto: os scripts do modo design não entram em nenhuma outra página.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

// O que se sabe de um elemento da página, para o Claude achá-lo no código: o tipo (botão, campo...),
// o texto, o caminho na página e as pistas do framework. Vai dentro do script do comentário, por
// isso é texto.
const CLUES = `
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
  const elementName = (el) => (ELEMENTS.find((e) => el.matches(e[0])) || [0, el.tagName.toLowerCase()])[1]
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 400)
  // Onde o elemento fica na página: os ancestros com id, classes e atributos que ajudam a achá-lo
  // no código (data-testid, role, aria-label, name).
  const describe = (n) => {
    let s = n.tagName.toLowerCase()
    if (n.id) s += '#' + n.id
    const cls = Array.from(n.classList).slice(0, 3)
    if (cls.length) s += '.' + cls.join('.')
    for (const a of ['data-testid', 'data-test', 'data-secao', 'role', 'aria-label', 'name']) {
      const v = n.getAttribute(a)
      if (v) s += '[' + a + '="' + v.slice(0, 40) + '"]'
    }
    return s
  }
  const pathOf = (el) => {
    const parts = []
    for (let n = el; n && n !== document.body && n !== document.documentElement && parts.length < 7; n = n.parentElement) parts.unshift(describe(n))
    return parts.join(' > ')
  }
  // Pistas do código-fonte que os frameworks deixam no modo de desenvolvimento: os componentes
  // acima do elemento e, quando há, o arquivo e a linha (React até a 18, Vue 3, Svelte).
  const sourceOf = (el) => {
    const out = []
    try {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
      if (key) {
        const names = []
        let file = null
        for (let f = el[key]; f && names.length < 6; f = f.return) {
          if (!file && f._debugSource) file = f._debugSource.fileName + ':' + f._debugSource.lineNumber
          const t = f.type
          if (t && typeof t !== 'string') {
            const n = t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name))
            if (n && names.indexOf(n) < 0) names.push(n)
          }
        }
        if (names.length) out.push('componentes React, do mais perto ao mais longe: ' + names.join(' < '))
        if (file) out.push('arquivo: ' + file)
      }
      for (let n = el; n && !out.length; n = n.parentElement) {
        const c = n.__vueParentComponent
        if (!c) continue
        const names = []
        let file = null
        for (let x = c; x && names.length < 6; x = x.parent) {
          const nm = x.type && (x.type.name || x.type.__name)
          if (nm && names.indexOf(nm) < 0) names.push(nm)
          if (!file && x.type && x.type.__file) file = x.type.__file
        }
        if (names.length) out.push('componentes Vue, do mais perto ao mais longe: ' + names.join(' < '))
        if (file) out.push('arquivo: ' + file)
      }
      for (let n = el; n; n = n.parentElement) {
        const m = n.__svelte_meta
        if (m && m.loc) {
          out.push('arquivo: ' + m.loc.file + ':' + (m.loc.line + 1))
          break
        }
      }
    } catch (e) {}
    return out.join('; ')
  }
`

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
// avisa o drawer, que mostra o caminho no campo de endereço. Avisa também os links da página para
// outras páginas do mesmo servidor (menus), que entram na lista do campo. Página carregada de novo
// perde o script; o drawer põe de novo a cada carga.
const TRACK = `(() => {
  if (window.__argusTrack) return
  window.__argusTrack = true
  const links = () => {
    const paths = new Set()
    for (const a of document.querySelectorAll('a[href]')) {
      try {
        const u = new URL(a.getAttribute('href'), location.href)
        if (u.origin === location.origin) paths.add(u.pathname)
      } catch (e) {}
      if (paths.size >= 200) break
    }
    parent.postMessage({ argus: 'links', paths: Array.from(paths) }, '*')
  }
  const send = () => {
    parent.postMessage({ argus: 'location', path: location.pathname + location.search + location.hash, title: document.title }, '*')
    // App React monta o menu depois de mudar o endereço: espera um pouco.
    setTimeout(links, 800)
  }
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name]
    history[name] = function (...args) {
      const result = original.apply(this, args)
      send()
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
  addEventListener('popstate', send)
  addEventListener('hashchange', send)
  send()
})()`

export function trackInPage(wc: WebContents, origin: string): void {
  inPage(wc, origin, TRACK)
}

// Comentários na página: ligado, o clique não chega à página; marca o ponto e manda ao drawer o
// elemento clicado (com as pistas para achá-lo no código). O balão é do drawer, desenhado por cima
// da página: daqui vai só a posição de cada ponto, de novo a cada rolagem (inclusive de uma área
// interna) e a cada pouco, para acompanhar a página que muda. Cada ponto fica preso ao elemento,
// na mesma distância do canto dele.
const COMMENT = `(() => {
  const w = window
  if (w.__argusComment) return
${CLUES}
  const anchors = new Map()
  let nextId = 1
  let active = false
  let frame = 0
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
    if (!active) return
    swallow(e)
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
      name: elementName(el),
      text: text(el),
      html: el.outerHTML.slice(0, 3000),
      path: pathOf(el),
      source: sourceOf(el)
    }, '*')
  }
  for (const t of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick']) addEventListener(t, swallow, true)
  addEventListener('click', click, true)
  addEventListener('scroll', schedule, true)
  addEventListener('resize', schedule)
  setInterval(schedule, 500)
  w.__argusComment = {
    on(v) {
      active = v
      if (v) document.head.appendChild(style)
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

export type CommentAction = 'on' | 'off' | 'remove' | 'clear'

export function commentInPage(wc: WebContents, origin: string, action: CommentAction, id?: number): void {
  const call =
    action === 'on' || action === 'off'
      ? `window.__argusComment.on(${action === 'on'})`
      : action === 'remove'
        ? `window.__argusComment.remove(${Number(id) || 0})`
        : 'window.__argusComment.clear()'
  inPage(wc, origin, `${COMMENT}; ${call}`)
}

// Retrato da tela em texto, para todo pedido: o que muda o entendimento do que a pessoa vê, sem
// imagem. A tela (componente principal e arquivo, quando o framework informa), o título, modais e
// gavetas abertos, avisos e erros à vista, campos com o que está preenchido (senha nunca), abas
// ativas, botões à vista e a rolagem. Só o que está visível; no máximo ~1.500 caracteres.
const STATE = `(() => {
${CLUES}
  const visible = (el) => {
    if (!el.getClientRects().length) return false
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && r.width > 0 && r.height > 0
  }
  const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
  const all = (sel) => Array.from(document.querySelectorAll(sel)).filter(visible)
  const lines = []
  const center = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight / 2, 300))
  const src = center ? sourceOf(center) : ''
  if (src) lines.push('- Código da tela: ' + src)
  const heading = all('h1, h2')[0]
  if (heading) lines.push('- Título à vista: "' + clip(text(heading), 80) + '"')
  const dialogs = all('[role=dialog], [role=alertdialog], [aria-modal=true], dialog[open]')
  for (const d of dialogs.slice(0, 2)) {
    const h = d.getAttribute('aria-label') || (d.querySelector('h1, h2, h3, [class*=title]') && text(d.querySelector('h1, h2, h3, [class*=title]'))) || ''
    lines.push('- Aberto por cima da tela: modal ou gaveta' + (h ? ' "' + clip(h, 60) + '"' : ''))
  }
  const alerts = all('[role=alert], [role=status], [aria-live=assertive], [class*=error]:not(input), [class*=erro]:not(input), [class*=warning], [class*=toast], [class*=notification]')
    .map((a) => text(a)).filter((t) => t && t.length < 160)
  const seen = new Set()
  const notes = alerts.filter((t) => !seen.has(t) && seen.add(t)).slice(0, 4)
  if (notes.length) lines.push('- Avisos à vista: ' + notes.map((t) => '"' + clip(t, 100) + '"').join('; '))
  const labelOf = (f) => {
    const id = f.getAttribute('id')
    const byFor = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null
    const wrap = f.closest('label')
    const item = f.closest('[class*=form-item], [class*=FormItem], [class*=field]')
    const itemLabel = item ? item.querySelector('label') : null
    return clip((byFor && text(byFor)) || f.getAttribute('aria-label') || (wrap && text(wrap)) || (itemLabel && text(itemLabel)) || f.getAttribute('placeholder') || f.getAttribute('name') || f.tagName.toLowerCase(), 40)
  }
  const fields = all('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').slice(0, 12).map((f) => {
    const type = (f.getAttribute('type') || '').toLowerCase()
    let value
    if (type === 'checkbox' || type === 'radio') value = f.checked ? 'marcado' : 'desmarcado'
    else if (type === 'password') value = f.value ? '(preenchido)' : 'vazio'
    else value = f.value ? '"' + clip(f.value, 40) + '"' : 'vazio'
    const bad = f.getAttribute('aria-invalid') === 'true' ? ' (com erro)' : ''
    const off = f.disabled ? ' (desabilitado)' : ''
    return labelOf(f) + ' = ' + value + bad + off
  })
  if (fields.length) lines.push('- Campos: ' + fields.join('; '))
  const tabs = all('[role=tab][aria-selected=true], [aria-current=page]').map((t) => clip(text(t), 30)).filter(Boolean).slice(0, 3)
  if (tabs.length) lines.push('- Selecionado: ' + tabs.join('; '))
  const buttons = all('button, [role=button], a[class*=btn], input[type=submit]').map((b) => clip(text(b) || b.getAttribute('value') || '', 30) + (b.disabled ? ' (desabilitado)' : '')).filter((t) => t.trim()).slice(0, 10)
  if (buttons.length) lines.push('- Botões à vista: ' + buttons.join('; '))
  const scroller = document.scrollingElement
  if (scroller && scroller.scrollHeight > innerHeight + 20) {
    const pct = Math.round((scroller.scrollTop / (scroller.scrollHeight - innerHeight)) * 100)
    lines.push('- Rolagem: ' + (pct <= 2 ? 'no topo' : pct >= 98 ? 'no fim' : pct + '% da página'))
  }
  return clip(lines.join('\n'), 1500)
})()`

// O retrato da página do protótipo (a do drawer, não um iframe dentro dela); nulo se não deu a tempo.
export async function snapshotPage(wc: WebContents, origin: string): Promise<string | null> {
  if (!LOCAL.test(origin)) return null
  const frame = wc.mainFrame.framesInSubtree.find((f) => {
    if (f.parent !== wc.mainFrame) return false
    try {
      return new URL(f.url).origin === origin
    } catch {
      return false
    }
  })
  if (!frame) return null
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
  const result = frame.executeJavaScript(STATE).then(
    (r: unknown) => (typeof r === 'string' && r ? r : null),
    () => null
  )
  return Promise.race([result, timeout])
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
