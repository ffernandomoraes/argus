// Geometria dos painéis flutuantes (drawers, lista de conversas): onde nascem, como se ajustam a
// uma área de outro tamanho e onde cabe um novo sem cobrir os fixados. Só contas, sem tela.

// `area` é o tamanho da área do canvas quando o rect foi definido: se a janela muda de tamanho
// (ex.: foi para outro monitor), o painel é reescalado na mesma proporção em vez de quebrar.
export type PanelRect = { x: number; y: number; width: number; height: number; area?: AreaSize }
export type AreaSize = { width: number; height: number }
export type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }

// Folga mínima entre o painel e as bordas da área (laterais, acima da barra de baixo e abaixo da barra de título).
export const PANEL_MARGIN = 8
const MARGIN = PANEL_MARGIN
// Barra de título transparente no topo da janela (TitleBar): os painéis começam abaixo dela.
export const TITLE_BAR_HEIGHT = 34
export const PANEL_TOP = TITLE_BAR_HEIGHT + MARGIN
// Barra de baixo (BottomBar), também fora do canvas: os painéis param acima dela.
export const BOTTOM_BAR_HEIGHT = 30
export const PANEL_BOTTOM = BOTTOM_BAR_HEIGHT + MARGIN
export const PANEL_MIN = { width: 360, height: 320 }
export const PANEL_DEFAULT_WIDTH = 550
// O painel da conversa nasce um pouco mais largo que os outros: é onde se lê e escreve.
export const DRAWER_DEFAULT_WIDTH = PANEL_DEFAULT_WIDTH + 50

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export type PanelSide = 'left' | 'right'

// Sem posição definida ainda, o painel nasce encostado num dos lados (a direita, por padrão), na
// altura toda.
export function defaultRect(area: AreaSize, defaultWidth: number, side: PanelSide = 'right'): PanelRect {
  const width = Math.min(defaultWidth, area.width - MARGIN * 2)
  const x = side === 'left' ? MARGIN : area.width - MARGIN - width
  return { x, y: PANEL_TOP, width, height: area.height - PANEL_TOP - PANEL_BOTTOM, area }
}

// Reposiciona o rect da área antiga para a nova mantendo a proporção do espaço útil
// (descontadas as margens e a barra de título), e garante que caiba inteiro na nova.
export function rescale(rect: PanelRect, from: AreaSize, to: AreaSize): PanelRect {
  const usable = (a: AreaSize) => ({ width: a.width - MARGIN * 2, height: a.height - PANEL_TOP - PANEL_BOTTOM })
  const a = usable(from)
  const b = usable(to)
  const sx = a.width > 0 ? b.width / a.width : 1
  const sy = a.height > 0 ? b.height / a.height : 1
  const width = clamp(rect.width * sx, Math.min(PANEL_MIN.width, b.width), b.width)
  const height = clamp(rect.height * sy, Math.min(PANEL_MIN.height, b.height), b.height)
  const x = clamp(MARGIN + (rect.x - MARGIN) * sx, MARGIN, to.width - MARGIN - width)
  const y = clamp(PANEL_TOP + (rect.y - PANEL_TOP) * sy, PANEL_TOP, to.height - PANEL_BOTTOM - height)
  return { x, y, width, height, area: to }
}

// Dois trechos [a, a+aLen] e [b, b+bLen] mais perto que a folga um do outro.
const near = (a: number, aLen: number, b: number, bLen: number) => a < b + bLen + MARGIN && b < a + aLen + MARGIN
const overlaps = (a: PanelRect, b: PanelRect) =>
  near(a.x, a.width, b.x, b.width) && near(a.y, a.height, b.y, b.height)

// Drawer que cobre o painel `aside` (a lista de conversas): vai para o lado dele com mais espaço,
// encolhendo só o que precisa. Sem cobrir, ou sem espaço nem para o mínimo, fica como está.
export function fitBeside(rect: PanelRect, aside: PanelRect): PanelRect {
  const area = rect.area ?? aside.area
  if (!area || !overlaps(rect, aside)) return rect
  const asideRight = aside.x + aside.width + MARGIN
  const rightSpace = area.width - MARGIN - asideRight
  const leftSpace = aside.x - MARGIN - MARGIN
  if (Math.max(rightSpace, leftSpace) < PANEL_MIN.width) return rect
  if (rightSpace >= leftSpace) {
    const x = Math.max(rect.x, asideRight)
    const right = clamp(rect.x + rect.width, x + PANEL_MIN.width, area.width - MARGIN)
    return { ...rect, x, width: right - x, area }
  }
  const right = Math.min(rect.x + rect.width, aside.x - MARGIN)
  const x = clamp(rect.x, MARGIN, right - PANEL_MIN.width)
  return { ...rect, x, width: right - x, area }
}

// Rect depois de arrastar (dx, dy) a partir de `rect`: todas as bordas juntas (mover) ou só
// algumas (redimensionar), sem sair da área nem ficar menor que o mínimo. Com `obstacles` (os
// outros drawers à vista), também não entra neles: para encostado, com a folga. Um que já começou
// por baixo deste não conta, para dar como separar os dois.
export function dragRect(
  rect: PanelRect,
  edges: Edges | 'move',
  dx: number,
  dy: number,
  area: AreaSize,
  obstacles: readonly PanelRect[] = []
): PanelRect {
  const os = obstacles.filter((o) => !overlaps(rect, o))
  const max = { right: area.width - MARGIN, bottom: area.height - PANEL_BOTTOM }
  if (edges === 'move') {
    const moved = {
      ...rect,
      x: clamp(rect.x + dx, MARGIN, max.right - rect.width),
      y: clamp(rect.y + dy, PANEL_TOP, max.bottom - rect.height),
      area
    }
    const hit = os.filter((o) => overlaps(moved, o))
    return hit.length ? slideAround(moved, hit, os, rect, max) : moved
  }
  // A borda só bate num outro se os dois se cruzam no outro eixo. Primeiro o horizontal, com a
  // altura de antes; depois o vertical, já com a largura nova (no canto, os dois mudam). Cada
  // borda para no mais perto dos que estão daquele lado.
  const crossesY = os.filter((o) => near(rect.y, rect.height, o.y, o.height))
  let { x, y, width, height } = rect
  if (edges.left) {
    const min = Math.max(MARGIN, ...crossesY.filter((o) => o.x + o.width <= rect.x).map((o) => o.x + o.width + MARGIN))
    x = clamp(rect.x + dx, min, rect.x + rect.width - PANEL_MIN.width)
    width = rect.x + rect.width - x
  }
  if (edges.right) {
    const right = Math.min(max.right, ...crossesY.filter((o) => o.x >= rect.x + rect.width).map((o) => o.x - MARGIN))
    width = clamp(rect.width + dx, PANEL_MIN.width, right - rect.x)
  }
  const crossesX = os.filter((o) => near(x, width, o.x, o.width))
  if (edges.top) {
    const min = Math.max(PANEL_TOP, ...crossesX.filter((o) => o.y + o.height <= rect.y).map((o) => o.y + o.height + MARGIN))
    y = clamp(rect.y + dy, min, rect.y + rect.height - PANEL_MIN.height)
    height = rect.y + rect.height - y
  }
  if (edges.bottom) {
    const bottom = Math.min(max.bottom, ...crossesX.filter((o) => o.y >= rect.y + rect.height).map((o) => o.y - MARGIN))
    height = clamp(rect.height + dy, PANEL_MIN.height, bottom - rect.y)
  }
  return { x, y, width, height, area }
}

// Arrastando para dentro de outro drawer: escorrega pela borda dele, encostado do lado mais perto
// de onde o ponteiro levaria, sem cair em cima de outro. Sem lado que sirva, fica onde começou.
function slideAround(
  moved: PanelRect,
  hit: PanelRect[],
  all: PanelRect[],
  start: PanelRect,
  max: { right: number; bottom: number }
): PanelRect {
  const options = hit
    .flatMap((o) => [
      { ...moved, x: o.x - MARGIN - moved.width },
      { ...moved, x: o.x + o.width + MARGIN },
      { ...moved, y: o.y - MARGIN - moved.height },
      { ...moved, y: o.y + o.height + MARGIN }
    ])
    .filter((r) => r.x >= MARGIN && r.x + r.width <= max.right && r.y >= PANEL_TOP && r.y + r.height <= max.bottom)
    .filter((r) => all.every((o) => !overlaps(r, o)))
  const distance = (r: PanelRect) => Math.abs(r.x - moved.x) + Math.abs(r.y - moved.y)
  const best = options.sort((a, b) => distance(a) - distance(b))[0]
  return best ?? { ...start, area: moved.area }
}

// Lugares ao redor de um painel: na mesma coluna, acima e abaixo dele (onde sobrar mais altura
// primeiro); depois ao lado, na largura padrão (ou no que couber), encostado nele e na altura toda.
function spotsAround(o: PanelRect, area: AreaSize, width: number): PanelRect[] {
  const bottom = area.height - PANEL_BOTTOM
  const above = o.y - MARGIN - PANEL_TOP
  const below = bottom - (o.y + o.height + MARGIN)
  const vertical = [
    { size: above, rect: { x: o.x, y: PANEL_TOP, width: o.width, height: above, area } },
    { size: below, rect: { x: o.x, y: o.y + o.height + MARGIN, width: o.width, height: below, area } }
  ].filter((s) => s.size >= PANEL_MIN.height)
  const left = o.x - MARGIN - MARGIN
  const right = area.width - MARGIN - (o.x + o.width + MARGIN)
  const side = [
    { size: left, rect: { x: o.x - MARGIN - Math.min(width, left), y: PANEL_TOP, width: Math.min(width, left), height: bottom - PANEL_TOP, area } },
    { size: right, rect: { x: o.x + o.width + MARGIN, y: PANEL_TOP, width: Math.min(width, right), height: bottom - PANEL_TOP, area } }
  ].filter((s) => s.size >= PANEL_MIN.width)
  const bySize = (a: { size: number }, b: { size: number }) => b.size - a.size
  return [...vertical.sort(bySize), ...side.sort(bySize)].map((s) => s.rect)
}

// Lugar de um painel novo que não cubra os fixados: ao redor de um deles, do mais recente para o
// mais antigo, sem cair em cima de outro. Sem espaço em lugar nenhum, nulo.
export function freeSpot(pinned: readonly PanelRect[], area: AreaSize, width: number): PanelRect | null {
  for (const o of [...pinned].reverse()) {
    const spot = spotsAround(o, area, width).find((r) => pinned.every((p) => !overlaps(r, p)))
    if (spot) return spot
  }
  return null
}

// Sem espaço livre: nasce em cascata, um degrau abaixo e ao lado do último (à esquerda; encostado
// na borda, à direita), do mesmo tamanho. Na altura toda, encolhe o degrau para descer.
export const CASCADE_STEP = 28
export function cascadeSpot(last: PanelRect, area: AreaSize): PanelRect {
  const width = Math.min(last.width, area.width - MARGIN * 2)
  const maxX = area.width - MARGIN - width
  const x = last.x - CASCADE_STEP >= MARGIN ? last.x - CASCADE_STEP : clamp(last.x + CASCADE_STEP, MARGIN, maxX)
  const y = Math.min(last.y + CASCADE_STEP, area.height - PANEL_BOTTOM - PANEL_MIN.height)
  const height = clamp(last.height, PANEL_MIN.height, area.height - PANEL_BOTTOM - y)
  return { x, y: Math.max(PANEL_TOP, y), width, height, area }
}
