import { MessageCircle, PenTool, Trash2 } from 'lucide-react'
import { isWslFolder, SYSTEM_NAME } from '../../platform'
import type { MenuItem } from '../ContextMenu'
import type { ConversationSummary, ProjectNode } from '../types'
import { isBusy, TRASH_EN } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

type ConversationDeps = Pick<Deps, 'openConversation' | 'confirm' | 'isPoppedOut' | 'trashConversation'>

// Conversa do modo design na lista da pasta: abre o drawer do design; apagar manda a pasta dele
// para a Lixeira (o código de um protótipo fica no projeto).
function designConversationMenu(deps: ConversationDeps, node: ProjectNode, conversation: ConversationSummary): MenuItem[] {
  return [
    { type: 'action', label: tr('Abrir design', 'Open design'), icon: PenTool, onSelect: () => deps.openConversation(node.id, conversation.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Mover design para a Lixeira', `Move design to ${TRASH_EN}`),
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: tr(`Mover "${conversation.title}" para a Lixeira?`, `Move "${conversation.title}" to ${TRASH_EN}?`),
          description: tr(
            `O design vai para a Lixeira do ${SYSTEM_NAME}. O código do protótipo continua no projeto, e a conversa dele volta para a lista como uma conversa comum.`,
            `The design goes to the ${SYSTEM_NAME} ${TRASH_EN}. The prototype code stays in the project, and its chat goes back to the list as a regular chat.`
          ),
          confirmLabel: tr('Mover para a Lixeira', `Move to ${TRASH_EN}`),
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
      label: tr('Abrir conversa', 'Open chat'),
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, conversation.id)
    },
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Mover conversa para a Lixeira', `Move chat to ${TRASH_EN}`),
      icon: Trash2,
      danger: true,
      onSelect: () => {
        if (isBusy(conversation)) {
          return deps.confirm({
            title: tr('Conversa em andamento', 'Chat in progress'),
            description: tr(
              `"${conversation.title}" ainda está rodando ou esperando sua resposta. Interrompa ou termine antes de mover para a Lixeira.`,
              `"${conversation.title}" is still running or waiting for your reply. Stop it or let it finish before moving it to ${TRASH_EN}.`
            )
          })
        }
        if (deps.isPoppedOut(conversation.id)) {
          return deps.confirm({
            title: tr('Conversa aberta em janela separada', 'Chat open in a separate window'),
            description: tr(
              `Feche a janela de "${conversation.title}" antes de mover a conversa para a Lixeira.`,
              `Close the "${conversation.title}" window before moving the chat to ${TRASH_EN}.`
            )
          })
        }
        deps.confirm({
          title: tr(`Mover "${conversation.title}" para a Lixeira?`, `Move "${conversation.title}" to ${TRASH_EN}?`),
          description: isWslFolder(node.data.path)
            ? tr(
                'O arquivo da conversa vai para a Lixeira do Linux (WSL), em ~/.local/share/Trash, e não para a do Windows. Ela some do Argus e do `claude --resume`. O projeto não é afetado.',
                'The chat file goes to the Linux (WSL) Trash, in ~/.local/share/Trash, not the Windows Recycle Bin. It disappears from Argus and from `claude --resume`. The project is not affected.'
              )
            : tr(
                `O arquivo da conversa vai para a Lixeira do ${SYSTEM_NAME}. Ela some do Argus e do \`claude --resume\`; para recuperar, restaure pela Lixeira. O projeto não é afetado.`,
                `The chat file goes to the ${SYSTEM_NAME} ${TRASH_EN}. It disappears from Argus and from \`claude --resume\`; to recover it, restore it from the ${TRASH_EN}. The project is not affected.`
              ),
          confirmLabel: tr('Mover para a Lixeira', `Move to ${TRASH_EN}`),
          onConfirm: () => deps.trashConversation(node.data.path, conversation.id)
        })
      }
    }
  ]
}
