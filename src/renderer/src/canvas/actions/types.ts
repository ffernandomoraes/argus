import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { CanvasNode } from '../types'

// Ação discreta no canvas: grava o estado anterior no desfazer e aplica (useHistory).
export type Change = (update: SetStateAction<CanvasNode[]>) => void

// O que as ações do canvas usam para ler e mudar a lista de nós. Tudo com identidade fixa.
export type NodesApi = {
  // Lista atual, para ler fora do render (menus, atalhos, avisos do processo principal).
  nodesRef: RefObject<CanvasNode[]>
  // Sem passar pelo desfazer: seleção, arraste, sessão amarrada ao terminal.
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  change: Change
}

// Seleciona o bloco e leva a câmera até ele (focus/useFocusNode).
export type FocusNode = (id: string, padding?: number) => void
