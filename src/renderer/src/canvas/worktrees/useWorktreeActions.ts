import { useMemo } from 'react'
import type { NodesApi } from '../actions/types'
import type { ConfirmRequest } from '../ConfirmDialog'
import type { DrawerCommands } from '../drawers/useDrawers'
import { createWorktreeNode } from '../factory'
import { isBusy } from '../menus/shared'
import { addWorktreeCard, removeNode } from '../operations'
import { getSessions } from '../sessionsStore'
import type { CanvasNode, ProjectNode } from '../types'
import { setJob } from './jobs'
import { tr } from '../../i18n'

const worktreeNode = (nodes: CanvasNode[], id: string): ProjectNode | null => {
  const node = nodes.find((n) => n.id === id)
  return node?.type === 'project' && node.data.worktree ? node : null
}

// Tempo mínimo do card piscando ao remover: duas idas e voltas da animação (worktree-removing).
const MIN_BLINK_MS = 1400

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('#', String(n)))

// Tarefas isoladas (git worktree) a partir da pasta e do card delas: criar e remover. Nome da
// branch e PR ficam com o agente, na conversa.
export function useWorktreeActions(
  { board, nodesRef, setNodes, change }: NodesApi,
  drawers: DrawerCommands,
  confirm: (request: ConfirmRequest) => void
) {
  return useMemo(() => {
    const remove = async (node: ProjectNode) => {
      const status = await window.api.worktrees.status(node.data.path).catch(() => null)
      const uncommitted = status?.uncommitted ?? 0
      const unpushed = status?.unpushed ?? 0
      const losing = [
        uncommitted && plural(uncommitted, tr('1 arquivo não comitado', '1 uncommitted file'), tr('# arquivos não comitados', '# uncommitted files')),
        unpushed && plural(unpushed, tr('1 commit não enviado', '1 unpushed commit'), tr('# commits não enviados', '# unpushed commits'))
      ].filter(Boolean)
      const created = status?.state !== 'pending'
      confirm({
        title: tr(`Remover a tarefa "${node.data.name}"?`, `Remove the task "${node.data.name}"?`),
        description: !created
          ? tr('A tarefa ainda não começou: nada foi criado no disco.', 'The task hasn’t started: nothing was created on disk.')
          : losing.length
            ? tr(
                `Ela tem ${losing.join(' e ')}, que se perdem com a pasta. A branch continua no repositório com o que já foi comitado.`,
                `It has ${losing.join(' and ')}, which are lost with the folder. The branch stays in the repository with what was already committed.`
              )
            : tr('A pasta da tarefa é apagada. A branch continua no repositório, com os commits.', 'The task’s folder is deleted. The branch stays in the repository, with its commits.'),
        confirmLabel: losing.length ? tr('Remover mesmo assim', 'Remove anyway') : tr('Remover tarefa', 'Remove task'),
        onConfirm: () => {
          setJob(node.id, { kind: 'removing' })
          // Pisca pelo menos um pouco: tarefa sem pasta (ou pasta pequena) sai na hora, e o card
          // sumiria sem dar para ver o que aconteceu.
          const shown = new Promise((resolve) => setTimeout(resolve, MIN_BLINK_MS))
          void Promise.all([window.api.worktrees.remove(node.data.path).catch((err: Error) => err.message), shown])
            .then(([err]) => {
              if (err) return setJob(node.id, { kind: 'failed', error: err })
              // O card sai ainda piscando (a saída do canvas some com ele dali); o aviso é limpo depois.
              // Sem volta pelo ⌘Z: a pasta já foi apagada (sai também do histórico).
              setNodes((ns) => removeNode(ns, node.id))
              window.api.canvas.forget(board, [node.id])
              setTimeout(() => setJob(node.id, null), 1000)
            })
        }
      })
    }

    return {
      // Reserva a pasta (a tarefa sai da branch em que a pasta está), põe o card embaixo dela e abre
      // uma conversa nova nele. O worktree de verdade nasce no primeiro envio (ver main/worktrees).
      newWorktree: async (parentId: string) => {
        const parent = nodesRef.current.find((n) => n.id === parentId)
        if (parent?.type !== 'project') return
        const result = await window.api.worktrees.reserve(parent.data.path).catch((err: Error) => ({ ok: false as const, error: err.message }))
        if (!result.ok) return confirm({ title: tr('Não deu para criar a tarefa', 'Couldn’t create the task'), description: result.error })
        const node = createWorktreeNode(result.path, tr('Nova tarefa', 'New task'), { of: parentId, base: result.base })
        change((ns) => addWorktreeCard(ns, parentId, node))
        drawers.show({ nodeId: node.id, conversationId: `new-${crypto.randomUUID()}`, draft: true })
      },
      // Conversa rodando na pasta impede: apagar a pasta debaixo dela quebraria o agente.
      removeWorktree: (nodeId: string) => {
        const node = worktreeNode(nodesRef.current, nodeId)
        if (!node) return
        const busy = getSessions(node.data.path).filter(isBusy)
        if (busy.length)
          return confirm({
            title: tr(`A tarefa "${node.data.name}" tem conversa em andamento`, `The task "${node.data.name}" has a chat in progress`),
            description: tr(
              'Interrompa ou termine a conversa antes de remover a tarefa: a pasta dela seria apagada com o agente trabalhando.',
              'Stop or finish the chat before removing the task: its folder would be deleted while the agent works.'
            )
          })
        void remove(node)
      }
    }
  }, [board, nodesRef, setNodes, change, drawers, confirm])
}
