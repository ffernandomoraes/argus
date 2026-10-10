import { useCallback, useMemo } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { LineRange } from '../../conversation/fileLinks'
import { useStableCallback } from '../../lib/useStableCallback'
import { getPreferences } from '../../settings/preferences'
import { patchView, type CanvasViewStore } from '../canvasView'
import type { ConfirmRequest } from '../ConfirmDialog'
import { projectOf } from '../drawers/drawerView'
import type { DrawerCommands } from '../drawers/useDrawers'
import { createChatPanel } from '../factory'
import { revealNode } from '../focus/reveal'
import { groupAccount, placeBeside, removeNode } from '../operations'
import { DESIGN_PREFIX, getSessions, refreshNow } from '../sessionsStore'
import type { ConversationSummary, ProjectData } from '../types'
import { chatPanelOf, ownerOf } from './lookup'
import type { FocusNode, NodesApi } from './types'

type Options = {
  api: NodesApi
  // Store do canvas: conversas em janela separada e o bloco recém-criado.
  view: CanvasViewStore
  focusNode: FocusNode
  drawers: DrawerCommands
  markPoppedOut: (id: string) => void
  // Conversa sem projeto aberta em branco: o Canvas cria o card quando a sessão começar (useLooseCards).
  watchLoose: (conversationId: string, at?: XYPosition) => void
  confirm: (request: ConfirmRequest) => void
}

// Resumo de reserva da conversa, enquanto a lista da pasta não foi lida (pasta em grupo recolhido
// desde a abertura, aberta pela notificação ou pela preferência). Quem mostra troca pelo da lista
// quando ela chegar (a janela separada e o bloco no canvas acompanham a lista da pasta).
const placeholder = (id: string): ConversationSummary => ({
  id,
  title: 'Conversa',
  kind: 'conversa',
  status: 'idle',
  updatedAt: '',
  contextPercent: 0,
  sessionId: id
})

// Abrir, mover e apagar conversas: no drawer, num bloco do canvas ou numa janela própria.
export function useConversationActions({ api, view, focusNode, drawers, markPoppedOut, watchLoose, confirm }: Options) {
  const { nodesRef, change } = api

  // Põe a conversa no canvas, ao lado da pasta (ou do card) de onde ela abriu. Se já estiver lá,
  // só vai até ela: a mesma conversa em dois blocos brigaria pela mesma sessão. Com a pasta num
  // grupo recolhido ou oculto, o grupo abre junto: senão o bloco nasceria escondido. A pasta
  // escondida pode não ter a lista de conversas lida ainda (a notificação chega antes): o bloco
  // nasce com o nome de reserva e mostra o título quando a lista chegar. O bloco é novo: pega o
  // foco ao aparecer (useIsNewBlock).
  const pinConversation = useCallback(
    (nodeId: string, conversationId: string) => {
      const existing = chatPanelOf(nodesRef.current, conversationId)
      if (existing) return focusNode(existing.id)
      const anchor = nodesRef.current.find((n) => n.id === nodeId)
      const project = projectOf(anchor)
      if (!anchor || !project) return
      const conversation = getSessions(project.path).find((c) => c.id === conversationId) ?? placeholder(conversationId)
      const node = createChatPanel(project, anchor.type === 'chat', conversation)
      patchView(view, { newBlockId: node.id })
      change((ns) => placeBeside(revealNode(ns, nodeId), nodeId, node))
      focusNode(node.id)
    },
    [nodesRef, change, focusNode, view]
  )

  // Abre a conversa numa janela própria (ou foca a que já existe). Com a lista da pasta ainda não
  // lida, vai o resumo de reserva: a janela lê a lista sozinha e mostra o título quando chegar.
  const popoutConversation = useCallback(
    (nodeId: string, conversationId: string) => {
      const node = nodesRef.current.find((n) => n.id === nodeId)
      const project = projectOf(node)
      if (!project) return
      const conversation = getSessions(project.path).find((c) => c.id === conversationId) ?? placeholder(conversationId)
      window.api.popout.open(conversationId, { project, conversation, account: groupAccount(nodesRef.current, node) })
      markPoppedOut(conversationId)
    },
    [nodesRef, markPoppedOut]
  )

  // Lê as janelas separadas do store na hora do clique.
  const openConversation = useStableCallback((nodeId: string, conversationId: string) => {
    // Conversa do modo design: abre o drawer do design, não o chat.
    if (conversationId.startsWith(DESIGN_PREFIX)) {
      return drawers.openDesign({ nodeId, designId: conversationId.slice(DESIGN_PREFIX.length) })
    }
    const openIn = getPreferences().openIn
    // Já no canvas: a câmera vai até o bloco dela.
    const panel = chatPanelOf(nodesRef.current, conversationId)
    if (panel) focusNode(panel.id)
    // Em janela separada (já aberta, ou pela preferência): abre ou traz a janela para frente.
    else if (view.get().poppedOut.has(conversationId) || openIn === 'window') popoutConversation(nodeId, conversationId)
    else if (openIn === 'node') pinConversation(nodeId, conversationId)
    else drawers.show({ nodeId, conversationId })
  })

  // Conversa na Lixeira: some do painel lateral e do canvas, se estiver aberta neles.
  const trashConversation = useCallback(
    (path: string, conversationId: string) => {
      void window.api.sessions.trash(path, conversationId).then((error) => {
        if (error) return confirm({ title: 'Não deu para mover a conversa para a Lixeira', description: error })
        drawers.forget(conversationId)
        const panel = chatPanelOf(nodesRef.current, conversationId)
        if (panel) change((ns) => removeNode(ns, panel.id))
        refreshNow(path)
      })
    },
    [nodesRef, change, drawers, confirm]
  )

  const rest = useMemo(
    () => ({
      newConversation: (nodeId: string) =>
        drawers.show({ nodeId, conversationId: `new-${crypto.randomUUID()}`, draft: true }),
      newLooseConversation: (position?: XYPosition) => {
        const conversationId = `new-${crypto.randomUUID()}`
        watchLoose(conversationId, position)
        drawers.show({ nodeId: null, conversationId, draft: true, at: position })
      },
      // O drawer do design fica no lugar do da conversa (e do código dela). Na pasta, sem designId,
      // começa um design novo (ela pode ter vários, cada um na lista dela).
      openDesign: (nodeId: string, designId?: string) => {
        const isProject = nodesRef.current.find((n) => n.id === nodeId)?.type === 'project'
        drawers.openDesign(isProject ? { nodeId, designId: designId ?? crypto.randomUUID() } : null)
      },
      // Conversa no canvas (ChatPanelNode): fechar tira o bloco (a conversa continua salva).
      closeChatPanel: (nodeId: string) => change((ns) => removeNode(ns, nodeId)),
      // O painel abre pela pasta (ou pelo card da conversa solta); sem ela no canvas, não tem por onde.
      chatPanelToDrawer: (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (node?.type !== 'chatPanel') return
        const owner = ownerOf(nodesRef.current, node.data.path, node.data.sessionId)
        if (!owner) return
        change((ns) => removeNode(ns, nodeId))
        drawers.show({ nodeId: owner.id, conversationId: node.data.sessionId })
      },
      chatPanelPopout: (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (node?.type !== 'chatPanel') return
        popoutConversation(nodeId, node.data.sessionId)
        change((ns) => removeNode(ns, nodeId))
      },
      // Link de arquivo clicado numa conversa do canvas: abre o código daquela pasta.
      openFileFrom: (project: ProjectData, path: string, lines?: LineRange, diff?: boolean) =>
        drawers.openFile({ project }, project.path, path, lines, diff)
    }),
    [nodesRef, change, drawers, popoutConversation, watchLoose]
  )

  return useMemo(
    () => ({ ...rest, openConversation, pinConversation, popoutConversation, trashConversation }),
    [rest, openConversation, pinConversation, popoutConversation, trashConversation]
  )
}
