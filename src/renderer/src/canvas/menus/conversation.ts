import { MessageCircle, PenTool, Trash2 } from 'lucide-react'
import { SYSTEM_NAME } from '../../platform'
import type { MenuItem } from '../ContextMenu'
import type { ConversationSummary, ProjectNode } from '../types'
import { isBusy } from './shared'
import type { Deps } from './types'

type ConversationDeps = Pick<Deps, 'openConversation' | 'confirm' | 'isPoppedOut' | 'trashConversation'>

// Conversa do modo design na lista da pasta: abre o drawer do design; apagar manda a pasta dele
// para a Lixeira (o código de um protótipo fica no projeto).
function designConversationMenu(deps: ConversationDeps, node: ProjectNode, conversation: ConversationSummary): MenuItem[] {
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

// Conversa na lista de uma pasta. A Lixeira leva o arquivo do Claude Code: some também do
// `claude --resume` e só volta restaurando pela Lixeira do sistema.
export function conversationMenu(deps: ConversationDeps, node: ProjectNode, conversation: ConversationSummary): MenuItem[] {
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
        if (deps.isPoppedOut(conversation.id)) {
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
