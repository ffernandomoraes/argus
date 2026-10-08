import { useEffect } from 'react'
import { getPreferences, setPreferences, usePreferences } from '../settings/preferences'

// Escala do conteúdo do drawer, no espírito do zoom do VS Code: texto, espaçamento e
// ícones crescem juntos. ⌘+ sobe um degrau, ⌘- desce um, ⌘0 volta ao normal.
// Enquanto o drawer está aberto, esses atalhos são dele: o canvas desliga os seus
// (ver useCanvasShortcuts). Fica salvo neste computador e vale nas duas janelas.
export const DRAWER_ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

function step(zoom: number, direction: 1 | -1): number {
  let closest = 0
  for (let i = 1; i < DRAWER_ZOOM_STEPS.length; i++) {
    if (Math.abs(DRAWER_ZOOM_STEPS[i] - zoom) < Math.abs(DRAWER_ZOOM_STEPS[closest] - zoom)) closest = i
  }
  const next = Math.min(DRAWER_ZOOM_STEPS.length - 1, Math.max(0, closest + direction))
  return DRAWER_ZOOM_STEPS[next]
}

// ⌘+, ⌘- e ⌘0 mudam a escala; devolve se a tecla era uma delas.
export function drawerZoomKey(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false
  // '+' e '_' aparecem quando o teclado manda a tecla já com shift.
  const direction = e.key === '=' || e.key === '+' ? 1 : e.key === '-' || e.key === '_' ? -1 : 0
  if (direction) setPreferences({ drawerZoom: step(getPreferences().drawerZoom, direction) })
  else if (e.key === '0') setPreferences({ drawerZoom: 1 })
  else return false
  e.preventDefault()
  return true
}

export function useDrawerZoom(): number {
  const zoom = usePreferences().drawerZoom

  useEffect(() => {
    window.addEventListener('keydown', drawerZoomKey)
    return () => window.removeEventListener('keydown', drawerZoomKey)
  }, [])

  return zoom
}
