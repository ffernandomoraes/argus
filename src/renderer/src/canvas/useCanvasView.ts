import { useContext, useEffect, useState } from 'react'
import { useStore } from '../lib/useStore'
import type { ActiveConversation } from './CanvasContext'
import { CanvasViewContext, type CanvasViewStore } from './canvasView'

// Leituras do estado do canvas por bloco (canvasView.ts): cada uma redesenha só quando o pedaço
// dela muda (ex.: renomear um bloco redesenha esse bloco, não os outros).

function useCanvasView(): CanvasViewStore {
  const view = useContext(CanvasViewContext)
  if (!view) throw new Error('useCanvasView fora do Canvas')
  return view
}

export function useIsRenaming(id: string): boolean {
  const view = useCanvasView()
  return useStore(view, (s) => s.renamingId === id)
}

export function useIsDropTarget(id: string): boolean {
  const view = useCanvasView()
  return useStore(view, (s) => s.dropTargetId === id)
}

export function useIsPoppedOut(conversationId: string): boolean {
  const view = useCanvasView()
  return useStore(view, (s) => s.poppedOut.has(conversationId))
}

// Todas as conversas em janela separada (o painel com a lista inteira de uma pasta).
export function usePoppedOutSet(): ReadonlySet<string> {
  const view = useCanvasView()
  return useStore(view, (s) => s.poppedOut)
}

// Conversa aberta no drawer, se ela abriu por este bloco (pasta ou card); senão, nula.
export function useActiveConversationIn(nodeId: string): ActiveConversation | null {
  const view = useCanvasView()
  return useStore(view, (s) => (s.activeConversation?.nodeId === nodeId ? s.activeConversation : null))
}

// Design aberto no drawer, se for desta pasta; senão, nulo.
export function useActiveDesignIn(nodeId: string): string | null {
  const view = useCanvasView()
  return useStore(view, (s) => (s.activeDesign?.nodeId === nodeId ? s.activeDesign.designId : null))
}

// Bloco recém-criado pela pessoa: verdadeiro só na montagem em que ele aparece pela primeira vez
// (consumido aqui). Use para o foco automático: o terminal e a conversa no canvas só pegam o foco
// quando são novos. Remontar (abrir o app, expandir o grupo, desfazer, a outra janela) não conta:
// com um terminal no canvas, apertar C no canvas mandava "c" para o claude.
export function useIsNewBlock(id: string): boolean {
  const view = useCanvasView()
  const [isNew] = useState(() => view.get().newBlockId === id)
  useEffect(() => {
    if (isNew) view.set((s) => (s.newBlockId === id ? { ...s, newBlockId: null } : s))
  }, [view, id, isNew])
  return isNew
}
