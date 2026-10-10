// Formas dos ícones da bandeja, num quadro de 18×18 pontos: cada uma diz se o ponto (x, y) é
// pintado. A rasterização fica em icons.ts.
//
// O desenho é o do ícone do app em miniatura: o cartão do projeto e duas conversas ligadas em
// árvore. O estado vai num selo redondo no canto de baixo; parado, sem selo.

export type Shape = (x: number, y: number) => boolean

function segment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

// Distância com sinal até a borda de um retângulo de cantos arredondados: negativa por dentro.
function roundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): number {
  const qx = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r)
  const qy = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

// Cartão cheio; no dev (outline), contorno de 1 ponto.
function card(outline: boolean, x: number, y: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = roundRect(x, y, x0, y0, x1, y1, 1.4)
  return outline ? d <= 0 && d >= -1 : d <= 0
}

const STROKE = 0.55

export const logo =
  (outline: boolean): Shape =>
  (x, y) => {
    const tree =
      segment(x, y, 3.5, 6.5, 3.5, 14.5) <= STROKE ||
      segment(x, y, 3.5, 10, 6, 10) <= STROKE ||
      segment(x, y, 3.5, 14.5, 6, 14.5) <= STROKE
    if (tree) return true
    if (card(outline, x, y, 1, 1.5, 15, 6.5)) {
      // A linha do título do projeto, vazada.
      return outline || segment(x, y, 5, 4, 11, 4) > 0.6
    }
    if (card(outline, x, y, 6, 8.5, 15, 11.5) || card(outline, x, y, 6, 13, 15, 16)) {
      // O ponto de estado de cada conversa, vazado.
      return outline || (Math.hypot(x - 7.8, y - 10) > 0.75 && Math.hypot(x - 7.8, y - 14.5) > 0.75)
    }
    return false
  }

// Selo do estado, por cima da segunda conversa, com uma folga vazia em volta.
const BX = 14.4
const BY = 14.4
const BR = 3.4
const GAP = 1

export const withBadge =
  (base: Shape, mark: Shape): Shape =>
  (x, y) => {
    const r = Math.hypot(x - BX, y - BY)
    if (r <= BR) return mark(x - BX, y - BY)
    if (r <= BR + GAP) return false
    return base(x, y)
  }

// Marcas do selo, em coordenadas relativas ao centro dele.
export const bang: Shape = (u, v) => segment(u, v, 0, -1.8, 0, 0.3) <= 0.6 || Math.hypot(u, v - 1.6) <= 0.65
export const check: Shape = (u, v) =>
  Math.min(segment(u, v, -1.6, 0.1, -0.5, 1.2), segment(u, v, -0.5, 1.2, 1.7, -1.1)) <= 0.55
export const cross: Shape = (u, v) =>
  Math.min(segment(u, v, -1.2, -1.2, 1.2, 1.2), segment(u, v, 1.2, -1.2, -1.2, 1.2)) <= 0.55

// Arco de 3/4 de volta dentro do selo, girado a cada quadro.
export const arc =
  (start: number): Shape =>
  (u, v) => {
    if (Math.abs(Math.hypot(u, v) - 2.6) > 0.75) return false
    const rel = (Math.atan2(v, u) - start + 4 * Math.PI) % (2 * Math.PI)
    return rel <= 1.5 * Math.PI
  }

// O selo é a marca vazada num disco cheio.
export const hollow =
  (mark: Shape): Shape =>
  (u, v) =>
    !mark(u, v)
