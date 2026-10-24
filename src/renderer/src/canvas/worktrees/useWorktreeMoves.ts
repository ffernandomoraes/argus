import { useEffect } from 'react'
import type { ChatWorktree } from '../../../../shared/chat'
import { sameFolder } from '../../platform'
import type { NodesApi } from '../actions/types'
import type { DrawerCommands } from '../drawers/useDrawers'
import { createWorktreeNode, displayPath } from '../factory'
import { addWorktreeCard, removeNode } from '../operations'
import type { CanvasNode, ProjectNode } from '../types'
import { tr } from '../../i18n'

const projectAt = (nodes: CanvasNode[], path: string): ProjectNode | undefined =>
  nodes.find((n): n is ProjectNode => n.type === 'project' && sameFolder(n.data.path, path))

// Id do card pela pasta do worktree: duas janelas do canvas recebem o mesmo aviso e criariam dois
// cards; com o mesmo id, a sincronização fica com um só.
function worktreeCardId(path: string): string {
  let h = 5381
  for (const c of path.normalize('NFC').toLowerCase()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  return `p-wt-${h.toString(36)}`
}

// O Claude levou a conversa para um git worktree (ferramenta EnterWorktree), criado por ele ou já
// existente, pedido pela pessoa ou não. O Claude Code muda o arquivo da conversa para a pasta de
// conversas do worktree, e ela sumiria da lista da pasta. Aqui ela vai para o card filho do
// worktree, embaixo da pasta, igual à "Nova tarefa em paralelo", e os drawers que a mostram abrem
// dele. Ao sair (ExitWorktree), a conversa volta para a pasta; com a pasta do worktree apagada, o
// card sai.
export function useWorktreeMoves({ board, nodesRef, change, setNodes }: Pick<NodesApi, 'board' | 'nodesRef' | 'change' | 'setNodes'>, drawers: DrawerCommands) {
  useEffect(() => {
    // Último aviso tratado por conversa: o estado chega uma vez por chave dela, e a cada mudança.
    const handled = new Map<string, string>()

    const enter = async (key: string, sessionId: string | undefined, wt: ChatWorktree) => {
      follow(sessionId, wt.path)
      let card = projectAt(nodesRef.current, wt.path)
      if (!card) {
        const here = projectAt(nodesRef.current, wt.from)
        // Saiu de um worktree para outro: o novo fica ao lado, embaixo da mesma pasta.
        const parentId = here?.data.worktree?.of ?? here?.id
        // Sem o card da pasta no canvas (a conversa só fixada), não há onde pendurar o worktree.
        if (!parentId) return
        const adopted = await window.api.worktrees.adopt(wt.path, wt.from).catch(() => null)
        if (!adopted?.ok) return
        const node = { ...createWorktreeNode(wt.path, tr('Nova tarefa', 'New task'), { of: parentId, base: adopted.base }), id: worktreeCardId(wt.path) }
        change((ns) => (projectAt(ns, wt.path) ? ns : addWorktreeCard(ns, parentId, node)))
        card = projectAt(nodesRef.current, wt.path) ?? node
      }
      drawers.moved(key, sessionId, card.id)
    }

    const leave = (key: string, sessionId: string | undefined, wt: ChatWorktree) => {
      const back = projectAt(nodesRef.current, wt.from)
      follow(sessionId, wt.from)
      if (back) drawers.moved(key, sessionId, back.id)
      const card = projectAt(nodesRef.current, wt.path)
      if (wt.left !== 'remove' || !card?.data.worktree) return
      // O Claude já apagou a pasta: aqui o Argus só esquece o worktree, e o card sai (sem ⌘Z).
      void window.api.worktrees.remove(card.data.path).finally(() => {
        setNodes((ns) => removeNode(ns, card.id))
        window.api.canvas.forget(board, [card.id])
      })
    }

    // Conversa fixada no canvas (o card dela) acompanha a pasta.
    const follow = (sessionId: string | undefined, path: string) => {
      const pinned = nodesRef.current.some((n) => n.type === 'chatPanel' && n.data.sessionId === sessionId && !sameFolder(n.data.path, path))
      if (!sessionId || !pinned) return
      const to = displayPath(path)
      change((ns) => ns.map((n) => (n.type === 'chatPanel' && n.data.sessionId === sessionId ? { ...n, data: { ...n.data, path: to } } : n)))
    }

    return window.api.chat.onState((key, state) => {
      const wt = state.worktree
      if (!wt) return
      const id = state.sessionId ?? key
      const seen = JSON.stringify(wt)
      if (handled.get(id) === seen) return
      handled.set(id, seen)
      if (wt.left) leave(key, state.sessionId, wt)
      else void enter(key, state.sessionId, wt)
    })
  }, [board, nodesRef, change, setNodes, drawers])
}
