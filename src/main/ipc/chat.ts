import type { UnreadChats } from '../app/unreadChats'
import type { ChatHolders } from '../chatHolders'
import type { Chats } from '../chats'
import { activeChats } from '../chats/entries'
import type { Terminals } from '../terminals'
import { materializeWorktree, withWorktreeHint } from '../worktrees'
import { handle, on } from './register'

// Conversas pelo chat (SDK do Claude).
export function registerChatIpc(chats: Chats, holders: ChatHolders, terminals: Terminals, unread: UnreadChats): void {
  handle('chat:state', (_e, key) => chats.state(key))
  handle('chat:active', () => activeChats(chats.list()))
  // Chat e terminal não ficam abertos juntos na mesma conversa: os dois gravariam na mesma
  // sessão. Abrir um encerra o outro; o histórico continua no arquivo da sessão.
  on('chat:send', async (_e, req) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    // Tarefa isolada reservada: o worktree nasce agora, com a branch provisória tirada do pedido.
    await materializeWorktree(req.cwd, req.text)
    // Conversa num worktree do Argus: o agente fica sabendo onde está (ver worktrees/hint.ts).
    chats.send({ ...req, hint: withWorktreeHint(req.hint, req.cwd) })
  })
  on('chat:remote-control', (_e, req) => {
    terminals.kill(req.key)
    if (req.sessionId) terminals.kill(req.sessionId)
    chats.remoteControl(req)
  })
  on('chat:answer', (_e, key, id, answer) => chats.answer(key, id, answer))
  handle('mcp:status', (_e, key, cwd, account) => chats.mcpStatus(key, cwd, account))
  handle('mcp:reconnect', (_e, key, name) => chats.reconnectMcp(key, name))
  handle('mcp:authenticate', (_e, key, name) => chats.authenticateMcp(key, name))
  handle('mcp:clearAuth', (_e, key, name) => chats.clearMcpAuth(key, name))
  handle('mcp:remove', (_e, key, cwd, account, name, scope) => chats.removeMcp(key, cwd, account, name, scope))
  handle('mcp:account:status', (_e, account, wait) => chats.accountMcp.status(account, wait))
  handle('mcp:account:reconnect', (_e, account, name) => chats.accountMcp.reconnect(account, name))
  handle('mcp:account:authenticate', (_e, account, name) => chats.accountMcp.authenticate(account, name))
  handle('mcp:account:clearAuth', (_e, account, name) => chats.accountMcp.clearAuth(account, name))
  handle('mcp:account:remove', (_e, account, name, scope) => chats.accountMcp.remove(account, name, scope))
  on('mcp:account:release', (_e, account) => chats.accountMcp.release(account))
  // Quem está com cada conversa na tela (ver ChatHolders): a sessão só fecha quando a última solta.
  on('chat:retain', (e, key) => holders.hold(key, e.sender))
  on('chat:release', (e, key) => holders.drop(key, e.sender.id))
  on('chat:restartIn', (_e, cwd) => chats.restartIn(cwd))
  on('chat:interrupt', (_e, key) => chats.interrupt(key))
  on('chat:configure', (_e, key, patch) => chats.configure(key, patch))
  on('chat:unread', (e, list) => unread.set(e.sender, list))
}
