import { ChevronDown, ChevronUp, FolderPlus, Fullscreen, LayoutGrid, Pencil, StickyNote, Trash2, Ungroup } from 'lucide-react'
import { resolveAccount } from '../../auth/useAuth'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import type { MenuItem } from '../ContextMenu'
import { childrenOf, fitGroupToContent, removeGroup, setGroupAccount, setGroupColor, terminalsIn, ungroup } from '../operations'
import type { AreaNode, CanvasNode, ProjectNode } from '../types'
import { terminalSubmenu } from './shared'
import type { Deps } from './types'

type GroupDeps = Pick<
  Deps,
  | 'nodes'
  | 'setNodes'
  | 'auth'
  | 'confirm'
  | 'startRename'
  | 'addFolder'
  | 'addTerminal'
  | 'addNote'
  | 'toggleGroup'
  | 'organizeGroup'
>

const plural = (n: number) => (n === 1 ? '1 instância' : `${n} instâncias`)

// Os terminais de dentro são encerrados junto com o grupo: a confirmação avisa.
const terminalsPhrase = (n: number) =>
  n === 0 ? '' : n === 1 ? ', e o terminal será encerrado' : `, e os ${n} terminais serão encerrados`

// Pasta de um grupo, para o terminal já abrir no lugar certo.
function folderOf(nodes: CanvasNode[], groupId: string): string | undefined {
  return nodes.find((n): n is ProjectNode => n.parentId === groupId && n.type === 'project')?.data.path
}

// "Conta do Claude ▸", só com mais de uma conta. O visto fica na que vale: a escolhida ou, sem
// escolha, a padrão.
function accountSubmenu(deps: Pick<Deps, 'auth' | 'setNodes'>, group: AreaNode): MenuItem[] {
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

export function groupMenu(deps: GroupDeps, group: AreaNode): MenuItem[] {
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
    {
      type: 'action',
      label: 'Organizar grupo',
      icon: LayoutGrid,
      disabled: count < 2 || !!group.data.collapsed,
      onSelect: () => deps.organizeGroup(group.id)
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
      onSelect: () => {
        const terminals = terminalsIn(deps.nodes, group.id)
        deps.confirm({
          title: `Excluir o grupo "${group.data.label}"?`,
          description:
            count > 0
              ? `${plural(count)} dentro dele também ${count === 1 ? 'será excluída' : 'serão excluídas'}${terminalsPhrase(terminals.length)}. Para mantê-las, use "Desagrupar tudo" antes.`
              : 'O grupo está vazio.',
          confirmLabel: 'Excluir grupo',
          onConfirm: () => {
            // O processo do terminal não morre quando o bloco sai da tela: sem isso, `claude` e
            // `pnpm dev` ficariam rodando escondidos até fechar o app.
            terminals.forEach((id) => window.api.terminal.kill(id))
            setNodes((ns) => removeGroup(ns, group.id))
          }
        })
      }
    }
  ]
}
