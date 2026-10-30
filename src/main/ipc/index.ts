import type { Lifecycle } from '../app/lifecycle'
import type { Services } from '../app/services'
import { registerAgentsIpc } from './agents'
import { registerAppIpc } from './app'
import { registerAuthIpc } from './auth'
import { registerCanvasIpc } from './canvas'
import { registerChatIpc } from './chat'
import { registerCliIpc } from './cli'
import { registerDesignIpc } from './design'
import { registerFilesIpc } from './files'
import { registerMemoryIpc } from './memory'
import { registerProvidersIpc } from './providers'
import { registerServersIpc } from './servers'
import { registerSessionsIpc } from './sessions'
import { registerSpeechIpc } from './speech'
import { registerTerminalIpc } from './terminal'
import { registerTranscriptionIpc } from './transcription'
import { registerWorktreesIpc } from './worktrees'

// Todos os canais que a janela usa, por assunto. O contrato (nomes, argumentos e respostas) está em
// src/shared/ipc.ts; cada registro recebe só os serviços de que precisa.
export function registerIpc(s: Services, life: Lifecycle): void {
  registerAppIpc(s, life)
  registerAuthIpc(s.auth)
  registerProvidersIpc(s.providers)
  registerSpeechIpc(s.speech)
  registerTranscriptionIpc()
  registerCanvasIpc(s.boards, s.canvasAgent, s.terminals)
  registerDesignIpc()
  registerMemoryIpc()
  registerAgentsIpc()
  registerSessionsIpc(s.sessionWatch)
  registerWorktreesIpc()
  registerServersIpc()
  registerFilesIpc(s.unsavedFiles)
  registerChatIpc(s.chats, s.chatHolders, s.terminals, s.unread, s.interrupted)
  registerTerminalIpc(s.terminals, s.chats, s.terminalViewers)
  registerCliIpc()
}
