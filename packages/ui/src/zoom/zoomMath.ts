// Contas do zoom de imagem (ver useZoomPan): o quanto aumenta e o deslocamento, em pixels da janela,
// aplicados como `translate(x, y) scale(scale)` com a origem no canto de cima à esquerda.
export type Zoom = { scale: number; x: number; y: number };

// Posição e tamanho da imagem sem o zoom, na janela.
export type Box = { left: number; top: number; width: number; height: number };

export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
export const MAX_SCALE = 8;
// Dois cliques (ou dois toques) aumentam isto, no ponto clicado.
export const DOUBLE_TAP_SCALE = 2.5;

export function baseBox(el: HTMLElement, zoom: Zoom): Box {
  const rect = el.getBoundingClientRect();
  return { left: rect.left - zoom.x, top: rect.top - zoom.y, width: el.offsetWidth, height: el.offsetHeight };
}

// Aumenta (ou diminui) mantendo parado o ponto da imagem que está sob `at` (na janela).
export function zoomAround(zoom: Zoom, box: Box, at: { x: number; y: number }, factor: number): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(1, zoom.scale * factor));
  const localX = (at.x - box.left - zoom.x) / zoom.scale;
  const localY = (at.y - box.top - zoom.y) / zoom.scale;
  return { scale, x: at.x - box.left - scale * localX, y: at.y - box.top - scale * localY };
}

// Num eixo: maior que a janela, a imagem não deixa sobrar fundo nas bordas; menor, fica centrada
// onde estava.
function clampAxis(offset: number, axis: { start: number; size: number }, scale: number, view: number): number {
  const scaled = axis.size * scale;
  if (scaled <= view) return (axis.size - scaled) / 2;
  return Math.min(-axis.start, Math.max(view - axis.start - scaled, offset));
}

export function clampZoom(zoom: Zoom, box: Box, view: { width: number; height: number }): Zoom {
  if (zoom.scale <= 1) return NO_ZOOM;
  return {
    scale: zoom.scale,
    x: clampAxis(zoom.x, { start: box.left, size: box.width }, zoom.scale, view.width),
    y: clampAxis(zoom.y, { start: box.top, size: box.height }, zoom.scale, view.height),
  };
}
