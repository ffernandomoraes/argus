// Geometria dos painéis flutuantes (drawers, lista de conversas): onde nascem, como se ajustam a
// uma área de outro tamanho e onde cabe um segundo sem cobrir o fixado. Só contas, sem tela.

// `area` é o tamanho da área do canvas quando o rect foi definido: se a janela muda de tamanho
// (ex.: foi para outro monitor), o painel é reescalado na mesma proporção em vez de quebrar.
export type PanelRect = { x: number; y: number; width: number; height: number; area?: AreaSize }
export type AreaSize = { width: number; height: number }
export type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean }

// Folga mínima entre o painel e as bordas da área (laterais, embaixo e abaixo da barra de título).
export const PANEL_MARGIN = 8
const MARGIN = PANEL_MARGIN
// Barra de título transparente no topo da janela (TitleBar): os painéis começam abaixo dela.
export const TITLE_BAR_HEIGHT = 40
export const PANEL_TOP = TITLE_BAR_HEIGHT + MARGIN
export const PANEL_MIN = { width: 360, height: 320 }
export const PANEL_DEFAULT_WIDTH = 550
// O painel da conversa nasce um pouco mais largo que os outros: é onde se lê e escreve.
export const DRAWER_DEFAULT_WIDTH = PANEL_DEFAULT_WIDTH + 50

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Sem posição definida ainda, o painel nasce encostado à direita, na altura toda.
export function defaultRect(area: AreaSize, defaultWidth: number): PanelRect {
  const width = Math.min(defaultWidth, area.width - MARGIN * 2)
  return { x: area.width - MARGIN - width, y: PANEL_TOP, width, height: area.height - PANEL_TOP - MARGIN, area }
}

// Reposiciona o rect da área antiga para a nova mantendo a proporção do espaço útil
// (descontadas as margens e a barra de título), e garante que caiba inteiro na nova.
export function rescale(rect: PanelRect, from: AreaSize, to: AreaSize): PanelRect {
  const usable = (a: AreaSize) => ({ width: a.width - MARGIN * 2, height: a.height - PANEL_TOP - MARGIN })
  const a = usable(from)
  const b = usable(to)
  const sx = a.width > 0 ? b.width / a.width : 1
  const sy = a.height > 0 ? b.height / a.height : 1
  const width = clamp(rect.width * sx, Math.min(PANEL_MIN.width, b.width), b.width)
  const height = clamp(rect.height * sy, Math.min(PANEL_MIN.height, b.height), b.height)
  const x = clamp(MARGIN + (rect.x - MARGIN) * sx, MARGIN, to.width - MARGIN - width)
  const y = clamp(PANEL_TOP + (rect.y - PANEL_TOP) * sy, PANEL_TOP, to.height - MARGIN - height)
  return { x, y, width, height, area: to }
}

// Rect depois de arrastar (dx, dy) a partir de `rect`: todas as bordas juntas (mover) ou só
// algumas (redimensionar), sem sair da área nem ficar menor que o mínimo.
export function dragRect(rect: PanelRect, edges: Edges | 'move', dx: number, dy: number, area: AreaSize): PanelRect {
  const max = { right: area.width - MARGIN, bottom: area.height - MARGIN }
  if (edges === 'move') {
    return {
      ...rect,
      x: clamp(rect.x + dx, MARGIN, max.right - rect.width),
      y: clamp(rect.y + dy, PANEL_TOP, max.bottom - rect.height),
      area
    }
  }
  let { x, y, width, height } = rect
  if (edges.left) {
    x = clamp(rect.x + dx, MARGIN, rect.x + rect.width - PANEL_MIN.width)
    width = rect.x + rect.width - x
  }
  if (edges.right) width = clamp(rect.width + dx, PANEL_MIN.width, max.right - rect.x)
  if (edges.top) {
    y = clamp(rect.y + dy, PANEL_TOP, rect.y + rect.height - PANEL_MIN.height)
    height = rect.y + rect.height - y
  }
  if (edges.bottom) height = clamp(rect.height + dy, PANEL_MIN.height, max.bottom - rect.y)
  return { x, y, width, height, area }
}

// Lugar de um segundo painel que não cubra o fixado. Primeiro na mesma coluna, acima ou abaixo dele
// (onde sobrar mais altura); sem altura para isso, ao lado, na largura padrão (ou no que couber),
// encostado nele e na altura toda. Sem espaço em lugar nenhum, nulo: nasce no lugar padrão.
export function freeSpot(pinned: PanelRect, area: AreaSize, width: number): PanelRect | null {
  const bottom = area.height - MARGIN
  const above = pinned.y - MARGIN - PANEL_TOP
  const below = bottom - (pinned.y + pinned.height + MARGIN)
  if (Math.max(above, below) >= PANEL_MIN.height) {
    const y = above > below ? PANEL_TOP : pinned.y + pinned.height + MARGIN
    return { x: pinned.x, y, width: pinned.width, height: Math.max(above, below), area }
  }
  const left = pinned.x - MARGIN - MARGIN
  const right = area.width - MARGIN - (pinned.x + pinned.width + MARGIN)
  if (Math.max(left, right) < PANEL_MIN.width) return null
  const w = Math.min(width, Math.max(left, right))
  const x = left > right ? pinned.x - MARGIN - w : pinned.x + pinned.width + MARGIN
  return { x, y: PANEL_TOP, width: w, height: bottom - PANEL_TOP, area }
}
