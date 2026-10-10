import { setWindowViewport, windowViewport } from '../app/canvasRegistry'
import { createCanvasWindow } from '../app/windows'
import type { CanvasAgent } from '../canvasAgent'
import type { CanvasHub } from '../canvasHub'
import { handle, on, onSync } from './register'

// O canvas (um só em todas as janelas), a câmera de cada janela e o assistente do canvas.
export function registerCanvasIpc(hub: CanvasHub, agent: CanvasAgent): void {
  onSync('canvas:load', () => hub.load())
  on('canvas:sync', (e, nodes) => hub.sync(nodes, e.sender))
  on('canvas:record', () => hub.record())
  on('canvas:undo', () => hub.undo())
  on('canvas:redo', () => hub.redo())
  onSync('canvas:viewport', (e) => windowViewport(e.sender))
  on('canvas:setViewport', (e, viewport) => setWindowViewport(e.sender, viewport))
  on('canvas:newWindow', () => void createCanvasWindow())
  handle('canvasAgent:state', () => agent.state)
  on('canvasAgent:send', (_e, text) => agent.send(text))
  on('canvasAgent:interrupt', () => agent.interrupt())
  on('canvasAgent:result', (_e, result) => agent.result(result))
}
