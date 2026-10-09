import type { Dispatch, SetStateAction } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FolderInput, Fullscreen, FolderOpen, PenTool, MessageCircle, MessageCirclePlus, PanelRight, Pencil, FolderPlus, SquareDashed, SquareTerminal, StickyNote, Terminal, Trash2, Ungroup, X } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { AuthState } from '../../../shared/auth'
import { resolveAccount } from '../auth/useAuth'
import type { ConfirmRequest } from './ConfirmDialog'
import type { MenuItem } from './ContextMenu'
import { childrenOf, fitGroupToContent, moveToGroup, removeGroup, removeNode, setGroupAccount, setGroupColor, setNoteColor, ungroup } from './operations'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import { getSessions } from './sessionsStore'
import { SYSTEM_NAME } from '../platform'
import type {
  AreaNode,
  CanvasNode,
  ChatNode,
  ChatPanelNode,
  ConversationSummary,
  NoteNode,
  ProjectNode,
  TerminalKind,
  TerminalNode
} from './types'

export type Deps = {
  nodes: CanvasNode[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  auth: AuthState | null
  confirm: (req: ConfirmRequest) => void
  startRename: (id: string) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  addNote: (position: XYPosition, groupId?: string) => void
  // folder vazio = pasta do usuário.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => void
  closeTerminal: (nodeId: string, name: string) => void
  toggleGroup: (id: string) => void
  leaveGroup: (id: string) => void
  newConversation: (nodeId: string) => void
  newLooseConversation: (position?: XYPosition) => void
  openConversation: (nodeId: string, conversationId: string) => void
  closeChatPanel: (nodeId: string) => void
  chatPanelToDrawer: (nodeId: string) => void
  chatPanelPopout: (nodeId: string) => void
  poppedOut: Set<string>
  trashConversation: (path: string, conversationId: string) => void
  openDesign: (nodeId: string, designId?: string) => void
}

const plural = (n: number) => (n === 1 ? '1 instância' : `${n} instâncias`)

// Rodando ou esperando resposta: tirar do canvas ou apagar agora atropelaria a sessão.
const isBusy = (c: ConversationSummary) => c.status === 'running' || c.status === 'needs-you'

// Lista de títulos para o aviso de bloqueio, entre aspas.
const titles = (cs: ConversationSummary[]) => cs.map((c) => `"${c.title}"`).join(', ')

// Pasta de um grupo, para o terminal já abrir no lugar certo.
function folderOf(nodes: CanvasNode[], groupId: string): string | undefined {
  return nodes.find((n): n is ProjectNode => n.parentId === groupId && n.type === 'project')?.data.path
}

// "Novo terminal ▸ Claude Code / Shell": os dois abrem na mesma pasta e no mesmo lugar.
function terminalSubmenu(label: string, open: (kind: TerminalKind) => void): MenuItem {
  return {
    type: 'submenu',
    label,
    icon: SquareTerminal,
    items: [
      { type: 'action', label: 'Claude Code', icon: ClaudeIcon, onSelect: () => open('claude') },
      { type: 'action', label: 'Shell', icon: Terminal, onSelect: () => open('shell') }
    ]
  }
}

export function paneMenu(deps: Deps, position: XYPosition): MenuItem[] {
  // Mesma ordem do menu da pasta: nota; conversa e terminal; e o que organiza o canvas.
  return [
    { type: 'action', label: 'Adicionar nota', icon: StickyNote, onSelect: () => deps.addNote(position) },
    { type: 'separator' },
    { type: 'action', label: 'Nova conversa', icon: MessageCirclePlus, onSelect: () => deps.newLooseConversation(position) },
    terminalSubmenu('Novo terminal', (kind) => deps.addTerminal(position, undefined, undefined, kind)),
    { type: 'separator' },
    { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => deps.addFolder(position) },
    { type: 'action', label: 'Criar grupo', icon: SquareDashed, onSelect: () => deps.addGroup(position) }
  ]
}

// "Conta do Claude ▸", só com mais de uma conta. O visto fica na que vale: a escolhida ou, sem
// escolha, a padrão.
function accountSubmenu(deps: Deps, group: AreaNode): MenuItem[] {
  const { auth } = deps
  if (!auth || auth.accounts.length < 2) return []
  const current = resolveAccount(auth, group.data.account)
  return [
    {
      type: 'submenu',
      label: 'Conta do Claude',
      icon: ClaudeIcon,
      items: auth.accounts.map((a) => ({
        type: 'action',
        label: a.status?.loggedIn === false ? `${a.name} - sem login` : a.name,
        checked: a.id === current,
        onSelect: () => deps.setNodes((ns) => setGroupAccount(ns, group.id, a.id))
      }))
    }
  ]
}

export function groupMenu(deps: Deps, group: AreaNode): MenuItem[] {
  const { setNodes } = deps
  const count = childrenOf(deps.nodes, group.id).length

  return [
    {
      type: 'colors',
      label: 'Cor',
      value: group.data.color,
      onSelect: (color) => setNodes((ns) => setGroupColor(ns, group.id, color))
    },
    ...accountSubmenu(deps, group),
    { type: 'separator' },
    {
      type: 'action',
      label: 'Nova pasta',
      icon: FolderPlus,
      onSelect: () => deps.addFolder(group.position, group.id)
    },
    // Dentro de um grupo com pastas, abre na primeira delas; senão na pasta do usuário.
    terminalSubmenu('Novo terminal', (kind) =>
      deps.addTerminal(group.position, group.id, folderOf(deps.nodes, group.id), kind)
    ),
    { type: 'action', label: 'Adicionar nota', icon: StickyNote, onSelect: () => deps.addNote(group.position, group.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: group.data.collapsed ? 'Expandir grupo' : 'Recolher grupo',
      icon: group.data.collapsed ? ChevronDown : ChevronUp,
      onSelect: () => deps.toggleGroup(group.id)
    },
    {
      type: 'action',
      label: 'Ajustar ao conteúdo',
      icon: Fullscreen,
      disabled: count === 0 || !!group.data.collapsed,
      onSelect: () => setNodes((ns) => fitGroupToContent(ns, group.id))
    },
    { type: 'action', label: 'Renomear grupo', icon: Pencil, onSelect: () => deps.startRename(group.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Desagrupar tudo',
      icon: Ungroup,
      disabled: count === 0,
      onSelect: () => setNodes((ns) => ungroup(ns, group.id))
    },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Excluir grupo',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: `Excluir o grupo "${group.data.label}"?`,
          description:
            count > 0
              ? `${plural(count)} dentro dele também ${count === 1 ? 'será excluída' : 'serão excluídas'}. Para mantê-las, use "Desagrupar tudo" antes.`
              : 'O grupo está vazio.',
          confirmLabel: 'Excluir grupo',
          onConfirm: () => setNodes((ns) => removeGroup(ns, group.id))
        })
    }
  ]
}

// "Mover para grupo": os outros grupos e, se já estiver num, a saída dele.
function moveSubmenu(deps: Deps, node: CanvasNode): MenuItem {
  const { setNodes } = deps
  const groups = deps.nodes.filter((n): n is AreaNode => n.type === 'area' && n.id !== node.parentId)

  const moveItems: MenuItem[] = groups.map((g) => ({
    type: 'action',
    label: g.data.label,
    onSelect: () => setNodes((ns) => moveToGroup(ns, node.id, g.id))
  }))
  if (moveItems.length === 0) {
    moveItems.push({ type: 'action', label: 'Nenhum outro grupo', disabled: true, onSelect: () => {} })
  }
  if (node.parentId) {
    moveItems.push(
      { type: 'separator' },
      {
        type: 'action',
        label: 'Tirar do grupo',
        icon: FolderOpen,
        onSelect: () => deps.leaveGroup(node.id)
      }
    )
  }
  return { type: 'submenu', label: 'Mover para grupo', icon: FolderInput, items: moveItems }
}

// "Abrir no GitHub" quando o remoto é do GitHub; outro host (GitLab, Bitbucket...) leva o nome
// genérico. Sem remoto, a opção não aparece.
function repoItem(node: ProjectNode, repoUrl: string | null): MenuItem[] {
  if (!repoUrl) return []
  const label = new URL(repoUrl).hostname === 'github.com' ? 'Abrir no GitHub' : 'Abrir repositório'
  return [{ type: 'action', label, icon: ExternalLink, onSelect: () => window.api.sessions.openRepo(node.data.path) }]
}

// `at`: onde foi o clique; a nota nasce ali, em cima da pasta.
export function instanceMenu(deps: Deps, node: ProjectNode, repoUrl: string | null, at: XYPosition): MenuItem[] {
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

// Conversa na lista de uma pasta. A Lixeira leva o arquivo do Claude Code: some também do
// `claude --resume` e só volta restaurando pela Lixeira do sistema.
// Conversa do modo design na lista da pasta: abre o drawer do design; apagar manda a pasta dele
// para a Lixeira (o código de um protótipo fica no projeto).
function designConversationMenu(deps: Deps, node: ProjectNode, conversation: ConversationSummary): MenuItem[] {
  return [
    { type: 'action', label: 'Abrir design', icon: PenTool, onSelect: () => deps.openConversation(node.id, conversation.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Mover design para a Lixeira',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: `Mover "${conversation.title}" para a Lixeira?`,
          description: `O design vai para a Lixeira do ${SYSTEM_NAME}. O código do protótipo continua no projeto, e a conversa dele volta para a lista como uma conversa comum.`,
          confirmLabel: 'Mover para a Lixeira',
          onConfirm: () => {
            if (conversation.designId) void window.api.design.trash(conversation.designId)
          }
        })
    }
  ]
}

export function conversationMenu(deps: Deps, node: ProjectNode, conversation: ConversationSummary): MenuItem[] {
  if (conversation.kind === 'design') return designConversationMenu(deps, node, conversation)
  return [
    {
      type: 'action',
      label: 'Abrir conversa',
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, conversation.id)
    },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Mover conversa para a Lixeira',
      icon: Trash2,
      danger: true,
      onSelect: () => {
        if (isBusy(conversation)) {
          return deps.confirm({
            title: 'Conversa em andamento',
            description: `"${conversation.title}" ainda está rodando ou esperando sua resposta. Interrompa ou termine antes de mover para a Lixeira.`
          })
        }
        if (deps.poppedOut.has(conversation.id)) {
          return deps.confirm({
            title: 'Conversa aberta em janela separada',
            description: `Feche a janela de "${conversation.title}" antes de mover a conversa para a Lixeira.`
          })
        }
        deps.confirm({
          title: `Mover "${conversation.title}" para a Lixeira?`,
          description: `O arquivo da conversa vai para a Lixeira do ${SYSTEM_NAME}. Ela some do Argus e do \`claude --resume\`; para recuperar, restaure pela Lixeira. O projeto não é afetado.`,
          confirmLabel: 'Mover para a Lixeira',
          onConfirm: () => deps.trashConversation(node.data.path, conversation.id)
        })
      }
    }
  ]
}

export function terminalMenu(deps: Deps, node: TerminalNode): MenuItem[] {
  return [
    { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Fechar terminal',
      icon: Trash2,
      danger: true,
      onSelect: () => deps.closeTerminal(node.id, node.data.name)
    }
  ]
}

// Conversa sem projeto: sair do canvas não apaga a conversa, que continua salva no Claude Code.
export function chatMenu(deps: Deps, node: ChatNode): MenuItem[] {
  const { setNodes } = deps
  return [
    {
      type: 'action',
      label: 'Abrir conversa',
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, node.data.sessionId)
    },
    { type: 'separator' },
    moveSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: 'Tirar do canvas',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: 'Tirar a conversa do canvas?',
          description: 'O card sai do canvas. A conversa continua salva no Claude Code.',
          confirmLabel: 'Tirar do canvas',
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id))
        })
    }
  ]
}

// Conversa no canvas: fechar só tira o bloco, sem perguntar, como o X do painel lateral.
export function chatPanelMenu(deps: Deps, node: ChatPanelNode): MenuItem[] {
  return [
    { type: 'action', label: 'Voltar para o painel lateral', icon: PanelRight, onSelect: () => deps.chatPanelToDrawer(node.id) },
    { type: 'action', label: 'Abrir em janela separada', icon: ExternalLink, onSelect: () => deps.chatPanelPopout(node.id) },
    { type: 'separator' },
    moveSubmenu(deps, node),
    { type: 'separator' },
    { type: 'action', label: 'Fechar conversa', icon: X, onSelect: () => deps.closeChatPanel(node.id) }
  ]
}

// Nota: excluir não pergunta, porque ⌘Z traz de volta.
export function noteMenu(deps: Deps, node: NoteNode): MenuItem[] {
  const { setNodes } = deps
  return [
    {
      type: 'colors',
      label: 'Cor',
      value: node.data.color,
      onSelect: (color) => setNodes((ns) => setNoteColor(ns, node.id, color))
    },
    { type: 'separator' },
    { type: 'action', label: 'Editar nota', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    moveSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: 'Excluir nota',
      icon: Trash2,
      danger: true,
      onSelect: () => setNodes((ns) => removeNode(ns, node.id))
    }
  ]
}
