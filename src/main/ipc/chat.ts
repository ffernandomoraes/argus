import type { ChatHolders } from '../chatHolders'
import type { Chats } from '../chats'
import type { Terminals } from '../terminals'
import { handle, on } from './register'

// Conversas pelo chat (SDK do Claude).
export function registerChatIpc(chats: Chats, holders: ChatHolders, terminals: Terminals): void {
  handle('chat:state', (_e, key) => chats.state(key))
  // Chat e terminal não ficam abertos juntos na mesma conversa: os dois gravariam na mesma
  // sessão. Abrir um encerra o outro; o histórico continua no arquivo da sessão.
  on('chat:send', (_e, req) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    chats.send(req)
  })
  on('chat:remote-control', (_e, req) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    chats.remoteControl(req)
  })
  on('chat:answer', (_e, key, id, answer) => chats.answer(key, id, answer))
  handle('mcp:status', (_e, key, cwd, account) => chats.mcpStatus(key, cwd, account))
  // Quem está com cada conversa na tela (ver ChatHolders): a sessão só fecha quando a última solta.
  on('chat:retain', (e, key) => holders.hold(key, e.sender))
  on('chat:release', (e, key) => holders.drop(key, e.sender.id))
  on('chat:interrupt', (_e, key) => chats.interrupt(key))
  on('chat:configure', (_e, key, patch) => chats.configure(key, patch))
}
