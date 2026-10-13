import { ChevronDown, ChevronUp, FolderPlus, Fullscreen, LayoutGrid, Pencil, StickyNote, Trash2, Ungroup } from 'lucide-react'
import { resolveAccount } from '../../auth/useAuth'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import type { MenuItem } from '../ContextMenu'
import { childrenOf, fitGroupToContent, removeGroup, setGroupAccount, setGroupColor, terminalsIn, ungroup } from '../operations'
import type { AreaNode, CanvasNode, ProjectNode } from '../types'
import { terminalSubmenu } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

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

const plural = (n: number) =>
  n === 1 ? tr('1 instância', '1 instance') : tr(`${n} instâncias`, `${n} instances`)

// Os terminais de dentro são encerrados junto com o grupo: a confirmação avisa.
const terminalsPhrase = (n: number) =>
  n === 0
    ? ''
    : n === 1
      ? tr(', e o terminal será encerrado', ', and the terminal will be closed')
      : tr(`, e os ${n} terminais serão encerrados`, `, and the ${n} terminals will be closed`)

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
      label: tr('Conta do Claude', 'Claude account'),
      icon: ClaudeIcon,
      items: auth.accounts.map((a) => ({
        type: 'action',
        label: a.status?.loggedIn === false ? tr(`${a.name} - sem login`, `${a.name} - not signed in`) : a.name,
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
      label: tr('Cor', 'Color'),
      value: group.data.color,
      onSelect: (color) => setNodes((ns) => setGroupColor(ns, group.id, color))
    },
    ...accountSubmenu(deps, group),
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Nova pasta', 'New folder'),
      icon: FolderPlus,
      onSelect: () => deps.addFolder(group.position, group.id)
    },
    // Dentro de um grupo com pastas, abre na primeira delas; senão na pasta do usuário.
    terminalSubmenu(tr('Novo terminal', 'New terminal'), (kind) =>
      deps.addTerminal(group.position, group.id, folderOf(deps.nodes, group.id), kind)
    ),
    { type: 'action', label: tr('Adicionar nota', 'Add note'), icon: StickyNote, onSelect: () => deps.addNote(group.position, group.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: group.data.collapsed ? tr('Expandir grupo', 'Expand group') : tr('Recolher grupo', 'Collapse group'),
      icon: group.data.collapsed ? ChevronDown : ChevronUp,
      onSelect: () => deps.toggleGroup(group.id)
    },
    {
      type: 'action',
      label: tr('Ajustar ao conteúdo', 'Fit to content'),
      icon: Fullscreen,
      disabled: count === 0 || !!group.data.collapsed,
      onSelect: () => setNodes((ns) => fitGroupToContent(ns, group.id))
    },
    {
      type: 'action',
      label: tr('Organizar grupo', 'Organize group'),
      icon: LayoutGrid,
      disabled: count < 2 || !!group.data.collapsed,
      onSelect: () => deps.organizeGroup(group.id)
    },
    { type: 'action', label: tr('Renomear grupo', 'Rename group'), icon: Pencil, onSelect: () => deps.startRename(group.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Desagrupar tudo', 'Ungroup all'),
      icon: Ungroup,
      disabled: count === 0,
      onSelect: () => setNodes((ns) => ungroup(ns, group.id))
    },
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Excluir grupo', 'Delete group'),
      icon: Trash2,
      danger: true,
      onSelect: () => {
        const terminals = terminalsIn(deps.nodes, group.id)
        deps.confirm({
          title: tr(`Excluir o grupo "${group.data.label}"?`, `Delete the group "${group.data.label}"?`),
          description:
            count > 0
              ? tr(
                  `${plural(count)} dentro dele também ${count === 1 ? 'será excluída' : 'serão excluídas'}${terminalsPhrase(terminals.length)}. Para mantê-las, use "Desagrupar tudo" antes.`,
                  `${plural(count)} inside it will also be deleted${terminalsPhrase(terminals.length)}. To keep them, use "Ungroup all" first.`
                )
              : tr('O grupo está vazio.', 'The group is empty.'),
          confirmLabel: tr('Excluir grupo', 'Delete group'),
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
