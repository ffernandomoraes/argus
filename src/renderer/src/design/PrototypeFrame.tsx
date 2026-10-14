import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { DEVICE_WIDTH, type DesignDevice } from '../../../shared/design'
import { tr } from '../i18n'

// A página do projeto na largura do dispositivo, reduzida para caber (ou no zoom escolhido) e
// rolando por dentro. Maior que o quadro, o quadro rola para os lados.
export function PrototypeFrame({
  url,
  device,
  reload,
  zoom,
  onFit,
  frameRef,
  onLoad,
  overlay
}: {
  url: string
  device: DesignDevice
  reload: number
  // Escala escolhida; null, a que cabe na largura (informada em onFit).
  zoom: number | null
  onFit: (fit: number) => void
  frameRef: RefObject<HTMLIFrameElement | null>
  onLoad: () => void
  // Por cima da página, nas medidas dela (pixels da página), com a mesma redução do quadro.
  // `loads`: quantas vezes a página carregou (o que vale para uma carga, como a posição dos
  // comentários, recomeça na seguinte).
  overlay?: (scale: number, loads: number) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [loads, setLoads] = useState(0)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])
  const width = DEVICE_WIDTH[device]
  const fit = size.width ? Math.min(1, size.width / width) : 1
  useEffect(() => onFit(fit), [fit, onFit])
  const scale = zoom ?? fit
  const shown = width * scale
  const inner = Math.max(size.width, shown)
  const box = { width, height: size.height / scale, left: (inner - shown) / 2, transform: `scale(${scale})` }
  // Zoom mudou: a página volta ao meio na horizontal.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }, [scale])
  return (
    <div ref={wrapRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="relative h-full" style={{ width: inner }}>
        {size.width > 0 && (
          <iframe
            key={reload}
            ref={frameRef}
            src={url}
            title={tr('Protótipo', 'Prototype')}
            onLoad={() => {
              setLoads((n) => n + 1)
              onLoad()
            }}
            // Sem allow-top-navigation: a página não consegue trocar a janela do Argus por ela.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            className="absolute top-0 origin-top-left border-0 bg-white"
            style={box}
          />
        )}
        {size.width > 0 && overlay && (
          <div className="pointer-events-none absolute top-0 z-10 origin-top-left overflow-visible" style={box}>
            {overlay(scale, loads)}
          </div>
        )}
      </div>
    </div>
  )
}
