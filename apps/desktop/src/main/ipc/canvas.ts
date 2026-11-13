import { setWindowViewport, windowViewport } from '../app/canvasRegistry'
import { createCanvasWindow } from '../app/windows'
import type { Boards } from '../boards'
import type { CanvasAgent } from '../canvasAgent'
import type { Terminals } from '../terminals'
import { handle, on, onSync } from './register'

// Os canvas (um por workspace), a câmera de cada janela e o assistente do canvas.
export function registerCanvasIpc(boards: Boards, agent: CanvasAgent, terminals: Terminals): void {
  onSync('canvas:load', (_e, board) => boards.hub(board)?.load() ?? null)
  on('canvas:sync', (e, board, nodes) => boards.hub(board)?.sync(nodes, e.sender))
  on('canvas:record', (_e, board) => boards.hub(board)?.record())
  on('canvas:undo', (_e, board) => boards.hub(board)?.undo())
  on('canvas:forget', (_e, board, ids) => boards.hub(board)?.forget(ids))
  on('canvas:redo', (_e, board) => boards.hub(board)?.redo())
  onSync('canvas:viewport', (e, board) => windowViewport(e.sender, board))
  on('canvas:setViewport', (e, board, viewport) => setWindowViewport(e.sender, board, viewport))
  on('canvas:newWindow', () => void createCanvasWindow())
  onSync('boards:state', (e) => boards.state(e.sender))
  on('boards:show', (e, board) => boards.show(e.sender, board))
  onSync('boards:create', (_e, name) => boards.create(name))
  on('boards:rename', (_e, board, name) => boards.rename(board, name))
  on('boards:close', (_e, board) => boards.close(board))
  on('boards:reopen', (_e, board) => boards.reopen(board))
  // Os terminais do workspace excluído não têm mais onde aparecer: fecham junto.
  on('boards:remove', (_e, board) => {
    for (const n of boards.remove(board) as { id?: unknown; type?: unknown }[]) {
      if (n?.type === 'terminal' && typeof n.id === 'string') terminals.kill(n.id)
    }
  })
  on('boards:put', (_e, board, nodes) => boards.put(board, nodes))
  handle('canvasAgent:state', () => agent.state)
  on('canvasAgent:send', (_e, text) => agent.send(text))
  on('canvasAgent:interrupt', () => agent.interrupt())
  on('canvasAgent:result', (_e, result) => agent.result(result))
}
