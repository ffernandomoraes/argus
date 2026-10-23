import { tr } from '../../i18n'
import { isWslFolder } from '../../platform'
import { useListState } from '../sessionsStore'

// O que a lista de conversas vazia diz: ainda lendo, a pasta sem resposta ou sem conversa nenhuma.
// Antes, com o WSL parado ou travado, aparecia "Nenhuma conversa ainda", e as conversas pareciam
// apagadas até ele voltar (2026-10-23).
export function useEmptyListText(path: string): string {
  const state = useListState(path)
  if (state === 'loading') return tr('Lendo conversas…', 'Reading chats…')
  if (state === 'unreadable')
    return isWslFolder(path)
      ? tr('O WSL não respondeu, tentando de novo', 'WSL didn’t respond, retrying')
      : tr('Não deu para ler as conversas, tentando de novo', 'Couldn’t read the chats, retrying')
  return tr('Nenhuma conversa ainda', 'No chats yet')
}
