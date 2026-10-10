import { useStore, type ReactFlowState } from '@xyflow/react'
import type { AreaData } from '../types'

function areaData(s: ReactFlowState, parentId: string | undefined): AreaData | undefined {
  const group = parentId ? s.nodeLookup.get(parentId) : undefined
  return group?.type === 'area' ? (group.data as AreaData) : undefined
}

// Grupo onde o bloco está: a conta do Claude (vale ao abrir uma sessão ali dentro) e a cor.
// Fora de grupo, os dois vazios. Cada um é lido à parte, como texto: arrastar o grupo ou mexer
// em outro campo dele não redesenha o bloco.
export function useGroupOf(parentId: string | undefined): { account?: string; color?: string } {
  const account = useStore((s) => areaData(s, parentId)?.account)
  const color = useStore((s) => areaData(s, parentId)?.color)
  return { account, color }
}
