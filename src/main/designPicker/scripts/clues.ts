// O que se sabe de um elemento da página, para o Claude achá-lo no código: o tipo (botão, campo...),
// o texto, o caminho na página e as pistas do framework. Vai dentro dos scripts do comentário e do
// retrato, por isso é texto.
export const CLUES = `
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
