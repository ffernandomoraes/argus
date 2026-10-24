import { ExternalLink, FolderMinus, FolderOpen, FolderPlus, GitBranchPlus, MessageCirclePlus, PenTool, Pencil, StickyNote, Trash2 } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { MenuItem } from '../ContextMenu'
import { groupAccount, removeNode } from '../operations'
import { getSessions } from '../sessionsStore'
import { getPreferences } from '../../settings/preferences'
import type { ConversationSummary, ProjectNode } from '../types'
import { baseName, FILE_MANAGER } from '../../platform'
import { boardSubmenu, isBusy, moveSubmenu, terminalSubmenu } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

type ProjectDeps = Pick<
  Deps,
  | 'nodes'
  | 'setNodes'
  | 'leaveGroup'
  | 'moveToBoard'
  | 'confirm'
  | 'startRename'
  | 'addNote'
  | 'addTerminal'
  | 'newConversation'
  | 'openDesign'
  | 'addWorkspaceFolder'
  | 'removeWorkspaceFolder'
  | 'newWorktree'
  | 'removeWorktree'
  | 'removeForever'
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

// Workspace: pôr e tirar pastas e abrir cada uma no Finder. Sem repositório nem design: cada
// pasta pode ser um repositório diferente. Nas conversas do grupo, as pastas são as do grupo: só
// abrir no Finder.
function workspaceItems(deps: ProjectDeps, node: ProjectNode, folders: string[]): MenuItem[] {
  const open: MenuItem = {
    type: 'submenu',
    label: tr(`Abrir no ${FILE_MANAGER}`, `Open in ${FILE_MANAGER}`),
    icon: FolderOpen,
    items: folders.map((f) => ({ type: 'action' as const, label: baseName(f), onSelect: () => window.api.files.openFolder(f) }))
  }
  if (node.data.groupWide) return folders.length ? [open] : []
  return [
    { type: 'action', label: tr('Adicionar pasta', 'Add folder'), icon: FolderPlus, onSelect: () => deps.addWorkspaceFolder(node.id) },
    {
      type: 'submenu',
      label: tr('Tirar pasta', 'Remove folder'),
      icon: FolderMinus,
      items: folders.map((f) => ({
        type: 'action' as const,
        label: baseName(f),
        // Fica pelo menos uma.
        disabled: folders.length < 2,
        onSelect: () => deps.removeWorkspaceFolder(node.id, f)
      }))
    },
    open
  ]
}

// Menu da pasta. `at`: onde foi o clique; a nota nasce ali, em cima da pasta.
export function instanceMenu(deps: ProjectDeps, node: ProjectNode, repoUrl: string | null, at: XYPosition): MenuItem[] {
  const { setNodes } = deps
  const repo = repoItem(node, repoUrl)
  const workspace = node.data.folders
  const worktree = node.data.worktree
  const groupWide = !!node.data.groupWide
  return [
    { type: 'action', label: tr('Adicionar nota', 'Add note'), icon: StickyNote, onSelect: () => deps.addNote(at) },
    { type: 'separator' },
    { type: 'action', label: tr('Nova conversa', 'New chat'), icon: MessageCirclePlus, onSelect: () => deps.newConversation(node.id) },
    terminalSubmenu(tr('Novo terminal aqui', 'New terminal here'), (kind, account) => deps.addTerminal(node.position, node.parentId, node.data.path, kind, account, workspace, workspace && node.data.name), groupAccount(deps.nodes, node)),
    // Modo design é experimento (Configurações > Experimentos). Sem design no workspace: o design é
    // do código e do servidor de um projeto só.
    ...(workspace || !getPreferences().designMode
      ? []
      : [{ type: 'action', label: tr('Novo design', 'New design'), icon: PenTool, experiment: true, onSelect: () => deps.openDesign(node.id) } as const]),
    // Tarefa em paralelo (git worktree) é experimento. Não sai de workspace (várias pastas, vários repositórios) nem de
    // outra tarefa: sai da pasta principal.
    ...(workspace || worktree || !getPreferences().worktrees
      ? []
      : [{ type: 'action', label: tr('Nova tarefa em paralelo', 'New parallel task'), icon: GitBranchPlus, experiment: true, onSelect: () => deps.newWorktree(node.id) } as const]),
    { type: 'separator' },
    ...(workspace
      ? workspaceItems(deps, node, workspace)
      : [{ type: 'action', label: tr(`Abrir no ${FILE_MANAGER}`, `Open in ${FILE_MANAGER}`), icon: FolderOpen, onSelect: () => window.api.files.openFolder(node.data.path) } as const, ...repo]),
    { type: 'separator' },
    // Conversas do grupo são daquele grupo: não mudam de grupo nem de workspace. A tarefa isolada
    // muda de workspace junto com a pasta dela.
    ...(groupWide ? [] : [moveSubmenu(deps, node)]),
    ...(groupWide || worktree ? [] : [boardSubmenu(deps, node)]),
    { type: 'action', label: tr('Renomear', 'Rename'), icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    // Tarefa isolada: remover apaga a pasta da cópia (a branch fica), depois de confirmar.
    ...(worktree
      ? [{ type: 'action', label: tr('Remover tarefa', 'Remove task'), icon: Trash2, danger: true, onSelect: () => deps.removeWorktree(node.id) } as const]
      : []),
    // Só sai do canvas: pasta e conversas ficam no disco. Com conversa em andamento, bloqueia
    // e diz qual é, para a pessoa interromper antes.
    // Conversas do grupo: o card sai (o ⌘Z traz de volta); as conversas ficam na pasta dele.
    ...(groupWide
      ? [{ type: 'action', label: tr('Tirar do canvas', 'Remove from canvas'), icon: Trash2, danger: true, onSelect: () => removeGroupWide(deps, node) } as const]
      : []),
    ...(worktree || groupWide ? [] : [{
      type: 'action',
      label: workspace ? tr('Tirar espaço de trabalho do canvas', 'Remove workspace from canvas') : tr('Tirar projeto do canvas', 'Remove project from canvas'),
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
          // Espaço de trabalho sai sem volta pelo ⌘Z; pasta comum pode voltar.
          onConfirm: () => (workspace ? deps.removeForever(node.id) : setNodes((ns) => removeNode(ns, node.id)))
        })
      }
    } as const])
  ]
}

// Com conversa em andamento, bloqueia, como a pasta. Sem confirmação: o ⌘Z traz o card de volta, com
// as conversas.
function removeGroupWide(deps: ProjectDeps, node: ProjectNode): void {
  const busy = getSessions(node.data.path).filter(isBusy)
  if (busy.length === 0) return deps.setNodes((ns) => removeNode(ns, node.id))
  deps.confirm({
    title: tr('As conversas do grupo têm conversa em andamento', 'The group chats have a chat in progress'),
    description: tr(
      `${busy.length === 1 ? 'A conversa' : 'As conversas'} ${titles(busy)} ${
        busy.length === 1 ? 'ainda está rodando ou esperando sua resposta' : 'ainda estão rodando ou esperando sua resposta'
      }. Interrompa ou termine antes de tirar o card do canvas.`,
      `${busy.length === 1 ? 'The chat' : 'The chats'} ${titles(busy)} ${
        busy.length === 1 ? 'is still running or waiting for your reply' : 'are still running or waiting for your reply'
      }. Stop or finish ${busy.length === 1 ? 'it' : 'them'} before removing the card from the canvas.`
    )
  })
}
