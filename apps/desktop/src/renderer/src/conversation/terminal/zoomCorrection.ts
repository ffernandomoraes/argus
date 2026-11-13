import type { Terminal } from '@xterm/xterm'

type Point = { clientX: number; clientY: number }
type Box = { left: number; top: number; width: number; height: number }

// Ponto do mouse como se o elemento não tivesse escala: o canvas aplica `transform: scale` (zoom)
// nos blocos, e o xterm acha a célula com (clientX - rect.left) / largura da célula, em pixels
// sem escala. Com 80% de zoom, a seleção pegava outra coluna. `layout` é o tamanho sem a escala
// (offsetWidth/offsetHeight); sem medida ou sem escala, devolve o próprio ponto.
export function unscalePoint(point: Point, rect: Box, layout: { width: number; height: number }): Point {
  if (!layout.width || !layout.height || !rect.width || !rect.height) return point
  const sx = rect.width / layout.width
  const sy = rect.height / layout.height
  if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return point
  return {
    clientX: rect.left + (point.clientX - rect.left) / sx,
    clientY: rect.top + (point.clientY - rect.top) / sy
  }
}

function unscaleEvent(event: Point, element: HTMLElement): Point {
  return unscalePoint(event, element.getBoundingClientRect(), {
    width: element.offsetWidth,
    height: element.offsetHeight
  })
}

type MouseService = {
  getCoords?: (event: Point, element: HTMLElement, ...rest: unknown[]) => unknown
  getMouseReportCoords?: (event: Point, element: HTMLElement, ...rest: unknown[]) => unknown
}

// Corrige seleção, links e cliques repassados ao programa (mouse do vim, por exemplo) com o zoom
// do canvas. Usa uma parte interna do xterm (o serviço de mouse, criado no `open`): se ela não
// existir nesta versão, não faz nada. Fora do zoom (modo foco), a escala é 1 e nada muda.
export function fixMouseForZoom(term: Terminal): void {
  const service = (term as unknown as { _core?: { _mouseService?: MouseService } })._core?._mouseService
  if (!service) return
  for (const name of ['getCoords', 'getMouseReportCoords'] as const) {
    const original = service[name]
    if (typeof original !== 'function') continue
    service[name] = (event, element, ...rest) => original.call(service, unscaleEvent(event, element), element, ...rest)
  }
}
