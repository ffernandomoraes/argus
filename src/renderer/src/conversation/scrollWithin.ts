// Rola só a área com rolagem mais próxima até o elemento, com a animação suave. O scrollIntoView
// rolaria também o que está em volta (o canvas, com a conversa num bloco, tem overflow escondido
// e saía do lugar). A conta passa pela escala da área (zoom do drawer, zoom do canvas).
export function scrollWithin(el: Element, block: 'start' | 'center' = 'start'): void {
  const area = scrollParent(el)
  if (!area) return
  const box = area.getBoundingClientRect()
  const target = el.getBoundingClientRect()
  const scale = area.offsetHeight ? box.height / area.offsetHeight : 1
  const offset = target.top - box.top - (block === 'center' ? (box.height - target.height) / 2 : 0)
  area.scrollTo({ top: area.scrollTop + offset / (scale || 1), behavior: 'smooth' })
}

function scrollParent(el: Element): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}
