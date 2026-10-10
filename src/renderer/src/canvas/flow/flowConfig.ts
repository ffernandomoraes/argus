import type { FitViewOptions, OnMove, ProOptions } from '@xyflow/react'
import { AreaNode } from '../AreaNode'
import { ChatNode } from '../ChatNode'
import { ChatPanelNode } from '../ChatPanelNode'
import { NoteNode } from '../NoteNode'
import { ProjectNode } from '../ProjectNode'
import { TerminalNode } from '../TerminalNode'

// Configuração fixa do React Flow, fora do componente: objeto ou lista nova a cada render faria o
// React Flow reconfigurar (e redesenhar) a cada render do canvas.

export const nodeTypes = {
  area: AreaNode,
  project: ProjectNode,
  terminal: TerminalNode,
  chat: ChatNode,
  chatPanel: ChatPanelNode,
  note: NoteNode
}

// Arrastar com o botão do meio move o canvas; com o esquerdo, seleciona (selectionOnDrag).
export const PAN_ON_DRAG = [1]

export const FIT_VIEW_OPTIONS: FitViewOptions = { padding: 0.15, maxZoom: 1 }

export const PRO_OPTIONS: ProOptions = { hideAttribution: true }

// O React Flow desliga o mouse (pointer-events: none) em nó que não é selecionável nem
// arrastável, a menos que exista onNodeClick. Sem isso, com o espaço pressionado (nada
// arrastável nem selecionável), o botão direito nos blocos atravessa para o canvas.
export const keepPointerEvents = () => {}

// Câmera desta janela, para ela abrir no mesmo lugar da próxima vez.
export const saveViewport: OnMove = (_, viewport) => window.api.canvas.setViewport(viewport)
