import { ExternalLink, MessageCirclePlus, PenTool, Pencil, StickyNote, Trash2 } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { MenuItem } from '../ContextMenu'
import { removeNode } from '../operations'
import { getSessions } from '../sessionsStore'
import type { ConversationSummary, ProjectNode } from '../types'
import { isBusy, moveSubmenu, terminalSubmenu } from './shared'
import type { Deps } from './types'

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
  const label = new URL(repoUrl).hostname === 'github.com' ? 'Abrir no GitHub' : 'Abrir repositório'
  return [{ type: 'action', label, icon: ExternalLink, onSelect: () => window.api.sessions.openRepo(node.data.path) }]
}

// Menu da pasta. `at`: onde foi o clique; a nota nasce ali, em cima da pasta.
export function instanceMenu(deps: ProjectDeps, node: ProjectNode, repoUrl: string | null, at: XYPosition): MenuItem[] {
  const { setNodes } = deps
  const repo = repoItem(node, repoUrl)
  return [
    { type: 'action', label: 'Adicionar nota', icon: StickyNote, onSelect: () => deps.addNote(at) },
    { type: 'separator' },
    { type: 'action', label: 'Nova conversa', icon: MessageCirclePlus, onSelect: () => deps.newConversation(node.id) },
    terminalSubmenu('Novo terminal aqui', (kind) => deps.addTerminal(node.position, node.parentId, node.data.path, kind)),
    { type: 'action', label: 'Novo design', icon: PenTool, onSelect: () => deps.openDesign(node.id) },
    { type: 'separator' },
    ...(repo.length ? [...repo, { type: 'separator' } as const] : []),
    moveSubmenu(deps, node),
    { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    // Só sai do canvas: pasta e conversas ficam no disco. Com conversa em andamento, bloqueia
    // e diz qual é, para a pessoa interromper antes.
    {
      type: 'action',
      label: 'Tirar projeto do canvas',
      icon: Trash2,
      danger: true,
      onSelect: () => {
        const conversations = getSessions(node.data.path)
        const busy = conversations.filter(isBusy)
        if (busy.length > 0) {
          return deps.confirm({
            title: `O projeto "${node.data.name}" tem conversa em andamento`,
            description: `${busy.length === 1 ? 'A conversa' : 'As conversas'} ${titles(busy)} ${
              busy.length === 1 ? 'ainda está rodando ou esperando sua resposta' : 'ainda estão rodando ou esperando sua resposta'
            }. Interrompa ou termine antes de tirar o projeto do canvas.`
          })
        }
        const count = conversations.length
        deps.confirm({
          title: `Tirar o projeto "${node.data.name}" do canvas?`,
          description: `${
            count === 0 ? 'O card do projeto' : count === 1 ? 'O card do projeto e a conversa dele' : `O card do projeto e as ${count} conversas dele`
          } saem do canvas. Nada é apagado do disco: a pasta e as conversas continuam lá, e o projeto pode voltar pelo "Nova pasta".`,
          confirmLabel: 'Tirar do canvas',
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id))
        })
      }
    }
  ]
}
