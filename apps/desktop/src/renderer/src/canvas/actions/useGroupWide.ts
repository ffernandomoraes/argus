import { useCallback, useEffect, useRef } from 'react'
import type { ConfirmRequest } from '../ConfirmDialog'
import { createGroupWide } from '../factory'
import { addNode, groupFolders, groupWideOf, isGroupWide, setGroupWideFolders } from '../operations'
import type { CanvasNode } from '../types'
import type { FocusNode, NodesApi } from './types'
import { tr } from '../../i18n'

// Conversas do grupo (ProjectData.groupWide): abrir o card do grupo e manter as pastas dele iguais às
// do grupo. Pôr ou tirar um card do grupo (arrastar, excluir, desfazer) muda a lista e o aviso que os
// agentes leem, e as sessões abertas reiniciam (chat:restartIn): a próxima mensagem já vai com a
// lista nova. Sem histórico: a lista segue o grupo, e desfazer o grupo já desfaz a lista.
export function useGroupWide(
  nodes: CanvasNode[],
  { nodesRef, setNodes, change }: NodesApi,
  focusNode: FocusNode,
  confirm: (request: ConfirmRequest) => void,
  newConversation: (nodeId: string) => void
) {
  // Lista pedida por card, enquanto a gravação da pasta não volta: a lista de nós muda a cada
  // quadro de um arraste, e cada mudança não pode pedir de novo.
  const pending = useRef(new Map<string, string>())

  useEffect(() => {
    for (const card of nodes) {
      if (!isGroupWide(card)) continue
      const current = card.data.folders ?? []
      const folders = card.parentId ? groupFolders(nodes, card.parentId, current) : []
      const key = folders.join('\n')
      // Voltou à lista de antes (desfazer no meio da gravação): a pedida não vale mais.
      if (key === current.join('\n')) {
        pending.current.delete(card.id)
        continue
      }
      if (pending.current.get(card.id) === key) continue
      pending.current.set(card.id, key)
      const { id, data } = card
      void window.api
        .syncWorkspace(folders, data.path)
        .catch(() => {})
        .then(() => {
          if (pending.current.get(id) !== key) return
          pending.current.delete(id)
          setNodes((ns) => setGroupWideFolders(ns, id, folders))
          window.api.chat.restartIn(data.path)
        })
    }
  }, [nodes, setNodes])

  // Um por grupo: o card que já existe ou um novo. Nulo se o grupo sumiu ou a pasta não foi criada.
  const ensureCard = useCallback(
    async (groupId: string): Promise<string | null> => {
      const group = nodesRef.current.find((n) => n.id === groupId)
      if (group?.type !== 'area') return null
      const existing = groupWideOf(nodesRef.current, groupId)
      if (existing) return existing.id
      const folders = groupFolders(nodesRef.current, groupId)
      const dir = await window.api.syncWorkspace(folders).catch((err: Error) => {
        confirm({ title: tr('Não deu para criar as conversas do grupo', 'Couldn’t create the group chats'), description: err.message })
        return null
      })
      if (!dir) return null
      const card = createGroupWide(group.position, folders, dir)
      change((ns) => addNode(ns, card, groupId))
      return card.id
    },
    [nodesRef, change, confirm]
  )

  // Menu do grupo: a câmera vai até o card.
  const openGroupWide = useCallback(
    async (groupId: string) => {
      const id = await ensureCard(groupId)
      if (id) focusNode(id)
    },
    [ensureCard, focusNode]
  )

  // "+" na borda do grupo: conversa nova do grupo todo, já aberta no painel lateral.
  const newGroupConversation = useCallback(
    async (groupId: string) => {
      const id = await ensureCard(groupId)
      if (id) newConversation(id)
    },
    [ensureCard, newConversation]
  )

  return { openGroupWide, newGroupConversation }
}
