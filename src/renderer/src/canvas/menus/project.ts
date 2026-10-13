import { ExternalLink, MessageCirclePlus, PenTool, Pencil, StickyNote, Trash2 } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { MenuItem } from '../ContextMenu'
import { removeNode } from '../operations'
import { getSessions } from '../sessionsStore'
import type { ConversationSummary, ProjectNode } from '../types'
import { isBusy, moveSubmenu, terminalSubmenu } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

type ProjectDeps = Pick<
  Deps,
  'nodes' | 'setNodes' | 'leaveGroup' | 'confirm' | 'startRename' | 'addNote' | 'addTerminal' | 'newConversation' | 'openDesign'
>

// Lista de títulos para o aviso de bloqueio, entre aspas.
const titles = (cs: ConversationSummary[]) => cs.map((c) => `"${c.title}"`).join(', ')

// "Abrir no GitHub" quando o remoto é do GitHub; outro host (GitLab, Bitbucket...) leva o nome
// genérico. Sem remoto, a opção não aparece.
function repoItem(node: ProjectNode, repoUrl: string | null): MenuItem[] {
  if (!repoUrl) return []
  const label = new URL(repoUrl).hostname === 'github.com' ? tr('Abrir no GitHub', 'Open on GitHub') : tr('Abrir repositório', 'Open repository')
  return [{ type: 'action', label, icon: ExternalLink, onSelect: () => window.api.sessions.openRepo(node.data.path) }]
}

// Menu da pasta. `at`: onde foi o clique; a nota nasce ali, em cima da pasta.
export function instanceMenu(deps: ProjectDeps, node: ProjectNode, repoUrl: string | null, at: XYPosition): MenuItem[] {
  const { setNodes } = deps
  const repo = repoItem(node, repoUrl)
  return [
    { type: 'action', label: tr('Adicionar nota', 'Add note'), icon: StickyNote, onSelect: () => deps.addNote(at) },
    { type: 'separator' },
    { type: 'action', label: tr('Nova conversa', 'New chat'), icon: MessageCirclePlus, onSelect: () => deps.newConversation(node.id) },
    terminalSubmenu(tr('Novo terminal aqui', 'New terminal here'), (kind) => deps.addTerminal(node.position, node.parentId, node.data.path, kind)),
    { type: 'action', label: tr('Novo design', 'New design'), icon: PenTool, onSelect: () => deps.openDesign(node.id) },
    { type: 'separator' },
    ...(repo.length ? [...repo, { type: 'separator' } as const] : []),
    moveSubmenu(deps, node),
    { type: 'action', label: tr('Renomear', 'Rename'), icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    // Só sai do canvas: pasta e conversas ficam no disco. Com conversa em andamento, bloqueia
    // e diz qual é, para a pessoa interromper antes.
    {
      type: 'action',
      label: tr('Tirar projeto do canvas', 'Remove project from canvas'),
      icon: Trash2,
      danger: true,
      onSelect: () => {
        const conversations = getSessions(node.data.path)
        const busy = conversations.filter(isBusy)
        if (busy.length > 0) {
          return deps.confirm({
            title: tr(
              `O projeto "${node.data.name}" tem conversa em andamento`,
              `The project "${node.data.name}" has a chat in progress`
            ),
            description: tr(
              `${busy.length === 1 ? 'A conversa' : 'As conversas'} ${titles(busy)} ${
                busy.length === 1 ? 'ainda está rodando ou esperando sua resposta' : 'ainda estão rodando ou esperando sua resposta'
              }. Interrompa ou termine antes de tirar o projeto do canvas.`,
              `${busy.length === 1 ? 'The chat' : 'The chats'} ${titles(busy)} ${
                busy.length === 1 ? 'is still running or waiting for your reply' : 'are still running or waiting for your reply'
              }. Stop or finish ${busy.length === 1 ? 'it' : 'them'} before removing the project from the canvas.`
            )
          })
        }
        const count = conversations.length
        deps.confirm({
          title: tr(`Tirar o projeto "${node.data.name}" do canvas?`, `Remove the project "${node.data.name}" from the canvas?`),
          description: tr(
            `${
              count === 0 ? 'O card do projeto' : count === 1 ? 'O card do projeto e a conversa dele' : `O card do projeto e as ${count} conversas dele`
            } saem do canvas. Nada é apagado do disco: a pasta e as conversas continuam lá, e o projeto pode voltar pelo "Nova pasta".`,
            `${
              count === 0
                ? 'The project card leaves'
                : count === 1
                  ? 'The project card and its chat leave'
                  : `The project card and its ${count} chats leave`
            } the canvas. Nothing is deleted from disk: the folder and chats stay there, and the project can come back through "New folder".`
          ),
          confirmLabel: tr('Tirar do canvas', 'Remove from canvas'),
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id))
        })
      }
    }
  ]
}
