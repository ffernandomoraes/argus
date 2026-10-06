import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './index.css'
import { App } from './App'
import { PopoutApp } from './conversation/PopoutApp'

// A mesma página serve a janela principal e as janelas de conversa (#popout/<id>).
const popout = location.hash.match(/^#popout\/(.+)$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{popout ? <PopoutApp id={decodeURIComponent(popout[1])} /> : <App />}</StrictMode>
)
