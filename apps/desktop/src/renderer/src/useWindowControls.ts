import { useEffect, useState } from 'react'
import { IS_MAC } from './platform'
import { usePreference } from './settings/preferences'

// Semáforos do Mac, à esquerda, em px de tela.
const TRAFFIC_LIGHTS = 80
// Minimizar, maximizar e fechar do Windows, à direita, quando a janela não informa a largura.
const WINDOWS_BUTTONS = 138

type Overlay = { getTitlebarAreaRect(): DOMRect; addEventListener(type: 'geometrychange', cb: () => void): void; removeEventListener(type: 'geometrychange', cb: () => void): void }

// Largura dos botões do Windows: o que sobra da janela à direita da área livre da barra de título.
function windowsButtons(zoom: number): number {
  const overlay = (navigator as Navigator & { windowControlsOverlay?: Overlay }).windowControlsOverlay
  const rect = overlay?.getTitlebarAreaRect()
  return rect && rect.width > 0 ? Math.max(0, Math.round(window.innerWidth - rect.x - rect.width)) : WINDOWS_BUTTONS / zoom
}

// Espaço que os botões da janela ocupam no topo, em px da página (já descontado o tamanho da
// interface): os semáforos à esquerda no Mac; minimizar, maximizar e fechar à direita no Windows
// (desenhados por cima da barra do app).
export function useWindowControls(): { left: number; right: number } {
  const zoom = usePreference('interfaceZoom')
  const [right, setRight] = useState(() => (IS_MAC ? 0 : windowsButtons(zoom)))

  useEffect(() => {
    if (IS_MAC) return
    const overlay = (navigator as Navigator & { windowControlsOverlay?: Overlay }).windowControlsOverlay
    const update = () => setRight(windowsButtons(zoom))
    update()
    overlay?.addEventListener('geometrychange', update)
    window.addEventListener('resize', update)
    return () => {
      overlay?.removeEventListener('geometrychange', update)
      window.removeEventListener('resize', update)
    }
  }, [zoom])

  return IS_MAC ? { left: TRAFFIC_LIGHTS / zoom, right: 0 } : { left: 0, right }
}
