import { Mail, MailOpen, MessageCircle, Pencil, Star, StarOff, Trash2 } from 'lucide-react'
import { isWslFolder, SYSTEM_NAME } from '../../platform'
import type { MenuItem } from '../ContextMenu'
import { startConversationRename, type RenamePlace } from '../conversationRename'
import { isFavorite, setFavorite } from '../favorites'
import { isUnread, markAsRead, markUnread } from '../sessionsStore'
import type { ConversationSummary, ProjectNode } from '../types'
import { isBusy, TRASH_EN } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

type ConversationDeps = Pick<Deps, 'openConversation' | 'confirm' | 'isPoppedOut' | 'trashConversation'>

// Conversa na lista de uma pasta. A Lixeira leva o arquivo do Claude Code: some também do
// `claude --resume` e só volta restaurando pela Lixeira do sistema.
export function conversationMenu(deps: ConversationDeps, node: ProjectNode, conversation: ConversationSummary, place: RenamePlace): MenuItem[] {
  return [
    {
      type: 'action',
      label: tr('Abrir conversa', 'Open chat'),
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, conversation.id)
    },
    renameItem(deps, node.data.path, conversation, place),
    favoriteItem(conversation),
    unreadItem(conversation),
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
          onConfirm: () => {
            setFavorite(conversation, false)
            deps.trashConversation(node.data.path, conversation.id)
          }
        })
      }
    }
  ]
}

// O título da linha vira campo (ver conversationRename). Também no card da conversa solta.
export function renameItem(
  deps: Pick<Deps, 'confirm'>,
  cwd: string,
  conversation: Pick<ConversationSummary, 'id' | 'sessionId'>,
  place: RenamePlace
): MenuItem {
  return {
    type: 'action',
    label: tr('Renomear', 'Rename'),
    icon: Pencil,
    onSelect: () =>
      startConversationRename(cwd, conversation, place, (error) =>
        deps.confirm({ title: tr('Não deu para renomear a conversa', "Couldn't rename the chat"), description: error })
      )
  }
}

function favoriteItem(conversation: ConversationSummary): MenuItem {
  const on = isFavorite(conversation)
  return {
    type: 'action',
    label: on ? tr('Remover dos favoritos', 'Remove from favorites') : tr('Favoritar', 'Add to favorites'),
    icon: on ? StarOff : Star,
    onSelect: () => setFavorite(conversation, !on)
  }
}

// A bolinha verde da lista, ligada à mão: a conversa aberta sem querer volta a parecer concluída.
function unreadItem(conversation: ConversationSummary): MenuItem {
  const on = isUnread(conversation.id)
  return {
    type: 'action',
    label: on ? tr('Marcar como lida', 'Mark as read') : tr('Marcar como não lida', 'Mark as unread'),
    icon: on ? MailOpen : Mail,
    onSelect: () => (on ? markAsRead(conversation.id) : markUnread(conversation.id))
  }
}
