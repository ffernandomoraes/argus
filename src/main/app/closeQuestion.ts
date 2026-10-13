import { basename } from 'node:path'
import { dialog } from 'electron'
import type { Chats } from '../chats'
import { tr } from '../i18n'
import type { Terminals } from '../terminals'
import type { UnsavedFiles } from './unsavedFiles'

// Fechar o app derruba as conversas e os terminais no meio do que estão fazendo: com algo em
// andamento, o app pergunta antes. Aqui ficam o que conta como "em andamento" e a pergunta.

const unsavedLabel = () => tr('Arquivo com alterações não salvas', 'File with unsaved changes')
const terminalIn = (cwd: string) => tr(`Terminal em ${basename(cwd)}`, `Terminal in ${basename(cwd)}`)

export function inProgress(chats: Chats, terminals: Terminals, unsaved: UnsavedFiles): string[] {
  const chatting = chats
    .list()
    .filter((c) => c.state.status !== 'idle' || c.state.agents.length > 0)
    .map((c) => tr(`Conversa em ${basename(c.cwd)}`, `Chat in ${basename(c.cwd)}`))
  const running = terminals.busy().map(terminalIn)
  // Rascunho do painel de código: só existe na memória da janela.
  const drafts = unsaved.any() ? [unsavedLabel()] : []
  return [...chatting, ...running, ...drafts]
}

// Windows: os shells dos terminais com algum comando rodando (ver Terminals.busyShells).
export async function busyShells(terminals: Terminals): Promise<string[]> {
  return (await terminals.busyShells()).map(terminalIn)
}

export async function askToClose(update: boolean, items: string[]): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: update
      ? tr('Atualizar agora interrompe o que está rodando.', 'Updating now stops what is running.')
      : tr('Fechar o Argus interrompe o que está rodando.', 'Quitting Argus stops what is running.'),
    detail: `${items.map((i) => `- ${i}`).join('\n')}\n\n${tr(
      'O que estiver no meio para e não continua sozinho.',
      "Anything in progress stops and won't resume on its own."
    )}${items.includes(unsavedLabel()) ? tr(' As alterações não salvas se perdem.', ' Unsaved changes will be lost.') : ''}`,
    buttons: [
      update ? tr('Atualizar mesmo assim', 'Update Anyway') : tr('Fechar mesmo assim', 'Quit Anyway'),
      tr('Cancelar', 'Cancel')
    ],
    defaultId: 1,
    cancelId: 1
  })
  return response === 0
}
