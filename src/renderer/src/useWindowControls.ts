import { useEffect, useState } from 'react'
import { IS_MAC } from './platform'

// Semáforos do Mac, à esquerda, em px de tela.
const TRAFFIC_LIGHTS = 80
// Minimizar, maximizar e fechar do Windows, à direita, quando a janela não informa a largura.
const WINDOWS_BUTTONS = 138

type Overlay = { getTitlebarAreaRect(): DOMRect; addEventListener(type: 'geometrychange', cb: () => void): void; removeEventListener(type: 'geometrychange', cb: () => void): void }

// Largura dos botões do Windows: o que sobra da janela à direita da área livre da barra de título.
function windowsButtons(): number {
  const overlay = (navigator as Navigator & { windowControlsOverlay?: Overlay }).windowControlsOverlay
  const rect = overlay?.getTitlebarAreaRect()
  return rect && rect.width > 0 ? Math.max(0, Math.round(window.innerWidth - rect.x - rect.width)) : WINDOWS_BUTTONS
}

// Espaço que os botões da janela ocupam no topo, em px de tela: os semáforos à esquerda no Mac;
// minimizar, maximizar e fechar à direita no Windows (desenhados por cima da barra do app).
export function useWindowControls(): { left: number; right: number } {
  const [right, setRight] = useState(() => (IS_MAC ? 0 : windowsButtons()))

  useEffect(() => {
    if (IS_MAC) return
    const overlay = (navigator as Navigator & { windowControlsOverlay?: Overlay }).windowControlsOverlay
    const update = () => setRight(windowsButtons())
    overlay?.addEventListener('geometrychange', update)
    window.addEventListener('resize', update)
    return () => {
      overlay?.removeEventListener('geometrychange', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return IS_MAC ? { left: TRAFFIC_LIGHTS, right: 0 } : { left: 0, right }
}
