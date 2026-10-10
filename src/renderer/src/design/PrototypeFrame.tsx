import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { DEVICE_WIDTH, type DesignDevice } from '../../../shared/design'

// A página do projeto na largura do dispositivo, reduzida para caber e rolando por dentro.
export function PrototypeFrame({
  url,
  device,
  reload,
  frameRef,
  onLoad,
  overlay
}: {
  url: string
  device: DesignDevice
  reload: number
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
  const scale = size.width ? Math.min(1, size.width / width) : 1
  const box = { width, height: size.height / scale, transform: `translateX(-50%) scale(${scale})` }
  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
      {size.width > 0 && (
        <iframe
          key={reload}
          ref={frameRef}
          src={url}
          title="Protótipo"
          onLoad={() => {
            setLoads((n) => n + 1)
            onLoad()
          }}
          // Sem allow-top-navigation: a página não consegue trocar a janela do Argus por ela.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          className="absolute left-1/2 top-0 origin-top border-0 bg-white"
          style={box}
        />
      )}
      {size.width > 0 && overlay && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 origin-top overflow-visible" style={box}>
          {overlay(scale, loads)}
        </div>
      )}
    </div>
  )
}
