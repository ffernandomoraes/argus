import { basename } from 'node:path'
import { dialog } from 'electron'
import type { Chats } from '../chats'
import type { Terminals } from '../terminals'
import type { UnsavedFiles } from './unsavedFiles'

// Fechar o app derruba as conversas e os terminais no meio do que estão fazendo: com algo em
// andamento, o app pergunta antes. Aqui ficam o que conta como "em andamento" e a pergunta.

const UNSAVED = 'Arquivo com alterações não salvas'

export function inProgress(chats: Chats, terminals: Terminals, unsaved: UnsavedFiles): string[] {
  const chatting = chats
    .list()
    .filter((c) => c.state.status !== 'idle' || c.state.agents.length > 0)
    .map((c) => `Conversa em ${basename(c.cwd)}`)
  const running = terminals.busy().map((cwd) => `Terminal em ${basename(cwd)}`)
  // Rascunho do painel de código: só existe na memória da janela.
  const drafts = unsaved.any() ? [UNSAVED] : []
  return [...chatting, ...running, ...drafts]
}

// Windows: os shells dos terminais com algum comando rodando (ver Terminals.busyShells).
export async function busyShells(terminals: Terminals): Promise<string[]> {
  return (await terminals.busyShells()).map((cwd) => `Terminal em ${basename(cwd)}`)
}

export async function askToClose(update: boolean, items: string[]): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: update
      ? 'Atualizar agora interrompe o que está rodando.'
      : 'Fechar o Argus interrompe o que está rodando.',
    detail: `${items.map((i) => `- ${i}`).join('\n')}\n\nO que estiver no meio para e não continua sozinho.${
      items.includes(UNSAVED) ? ' As alterações não salvas se perdem.' : ''
    }`,
    buttons: [update ? 'Atualizar mesmo assim' : 'Fechar mesmo assim', 'Cancelar'],
    defaultId: 1,
    cancelId: 1
  })
  return response === 0
}
