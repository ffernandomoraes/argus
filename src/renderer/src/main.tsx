import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './index.css'
import { App } from './App'
import { PopoutApp } from './conversation/PopoutApp'

// Cor de destaque do sistema antes do primeiro desenho, para não piscar o azul padrão. Sem ela,
// vale a do index.css.
const applyAccent = (color: string | null) =>
  color
    ? document.documentElement.style.setProperty('--color-accent', color)
    : document.documentElement.style.removeProperty('--color-accent')
applyAccent(window.api.accent.get())
window.api.accent.onChange(applyAccent)

// A mesma página serve a janela principal e as janelas de conversa (#popout/<id>).
const popout = location.hash.match(/^#popout\/(.+)$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{popout ? <PopoutApp id={decodeURIComponent(popout[1])} /> : <App />}</StrictMode>
)
