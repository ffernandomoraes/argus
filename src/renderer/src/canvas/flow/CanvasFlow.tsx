import { memo, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { Background, BackgroundVariant, ReactFlow, type NodeMouseHandler, type OnNodeDrag } from '@xyflow/react'
import type { CanvasViewport } from '../../../../shared/canvas'
import type { ResolvedTheme } from '../../theme/useTheme'
import type { NodesApi } from '../actions/types'
import { AlignmentGuides } from '../AlignmentGuides'
import { EdgeFade } from '../EdgeFade'
import { NavBar } from '../NavBar'
import type { CanvasNode } from '../types'
import { ViewBar } from '../ViewBar'
import { displayNodes } from './displayNodes'
import { FIT_VIEW_OPTIONS, keepPointerEvents, nodeTypes, PAN_ON_DRAG, PRO_OPTIONS, saveViewport } from './flowConfig'
import { useNodeMotion } from './useNodeMotion'
import { useNodesChange } from './useNodesChange'

type Props = {
  nodes: CanvasNode[]
  nodesRef: NodesApi['nodesRef']
  setNodes: NodesApi['setNodes']
  trackGesture: (active: boolean) => void
  onNodeDrag: OnNodeDrag<CanvasNode>
  onNodeDragStop: OnNodeDrag<CanvasNode>
  onPaneContextMenu: (e: ReactMouseEvent | MouseEvent) => void
  onNodeContextMenu: NodeMouseHandler<CanvasNode>
  // Mexer a câmera fecha o menu de botão direito.
  onMoveStart: () => void
  colorMode: ResolvedTheme
  savedViewport: CanvasViewport | null
  // Espaço segurado: modo câmera, nada arrastável nem selecionável.
  spaceHeld: boolean
  uiHidden: boolean
  arranging: boolean
  // Com o drawer aberto, ⌘+ / ⌘- escalam o drawer em vez do canvas.
  zoomShortcuts: boolean
}

// O React Flow com os blocos, o fundo de pontos, as linhas-guia e as barras flutuantes. Só
// redesenha quando muda o que é dele: drawer, modal ou menu abrindo no Canvas não chega aqui.
function CanvasFlowView(props: Props) {
  const { nodes, nodesRef, setNodes, trackGesture, spaceHeld, uiHidden, arranging, savedViewport } = props
  const flowNodes = useMemo(() => displayNodes(nodes), [nodes])
  const motion = useNodeMotion(flowNodes)
  const { onNodesChange, guides } = useNodesChange({ nodesRef, setNodes, trackGesture, leaving: motion.leaving })
  const className = [
    spaceHeld && 'camera-mode',
    motion.booting && 'canvas-booting',
    uiHidden && 'ui-hidden',
    arranging && 'arranging'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ReactFlow
      nodes={motion.shown}
      onNodeClick={keepPointerEvents}
      zoomOnDoubleClick={false}
      onNodesChange={onNodesChange}
      onNodeDrag={props.onNodeDrag}
      onNodeDragStop={props.onNodeDragStop}
      nodeTypes={nodeTypes}
      className={className}
      nodesDraggable={!spaceHeld}
      elementsSelectable={!spaceHeld}
      onPaneContextMenu={props.onPaneContextMenu}
      onNodeContextMenu={props.onNodeContextMenu}
      onMoveStart={props.onMoveStart}
      onMoveEnd={saveViewport}
      deleteKeyCode={null}
      colorMode={props.colorMode}
      fitView={!savedViewport}
      defaultViewport={savedViewport ?? undefined}
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={0.1}
      maxZoom={2}
      panOnScroll
      selectionOnDrag
      panOnDrag={PAN_ON_DRAG}
      proOptions={PRO_OPTIONS}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-dots)" />
      <AlignmentGuides guides={guides} />
      <EdgeFade />
      <ViewBar />
      <NavBar zoomShortcuts={props.zoomShortcuts} />
    </ReactFlow>
  )
}

export const CanvasFlow = memo(CanvasFlowView)
