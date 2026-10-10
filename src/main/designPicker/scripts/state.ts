import { CLUES } from './clues'

// Retrato da tela em texto, para todo pedido: o que muda o entendimento do que a pessoa vê, sem
// imagem. A tela (componente principal e arquivo, quando o framework informa), o título, modais e
// gavetas abertos, avisos e erros à vista, campos com o que está preenchido, abas ativas, botões à
// vista e a rolagem. Só o que está visível; no máximo ~1.500 caracteres.
// Campo com segredo nunca vai com o valor, só "(preenchido)": senha (também a mostrada em texto,
// pelo autocomplete), cartão e código de uso único, e campos cujo nome, id ou rótulo denunciam
// (token, chave, CPF, cartão, senha).
export const STATE = `(() => {
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
  const SECRET = /token|secret|key|cpf|card|cart[aã]o|password|senha/i
  const secret = (f, type, label) => {
    if (type === 'password') return true
    const auto = (f.getAttribute('autocomplete') || '').toLowerCase()
    if (/(^|\\s)(cc-[a-z-]+|one-time-code|current-password|new-password)(\\s|$)/.test(auto)) return true
    return SECRET.test((f.getAttribute('name') || '') + ' ' + (f.getAttribute('id') || '') + ' ' + label)
  }
  const fields = all('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').slice(0, 12).map((f) => {
    const type = (f.getAttribute('type') || '').toLowerCase()
    const label = labelOf(f)
    let value
    if (type === 'checkbox' || type === 'radio') value = f.checked ? 'marcado' : 'desmarcado'
    else if (secret(f, type, label)) value = f.value ? '(preenchido)' : 'vazio'
    else value = f.value ? '"' + clip(f.value, 40) + '"' : 'vazio'
    const bad = f.getAttribute('aria-invalid') === 'true' ? ' (com erro)' : ''
    const off = f.disabled ? ' (desabilitado)' : ''
    return label + ' = ' + value + bad + off
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
  return clip(lines.join('\\n'), 1500)
})()`
