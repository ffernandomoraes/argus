import type { TerminalViewers } from '../app/terminalViewers'
import type { Chats } from '../chats'
import type { Terminals } from '../terminals'
import { handle, on } from './register'

// Terminais (o `claude` no terminal ou um shell). A saída vai só para as janelas que abriram cada um.
export function registerTerminalIpc(terminals: Terminals, chats: Chats, viewers: TerminalViewers): void {
  // Chat e terminal não ficam abertos juntos na mesma conversa: os dois gravariam na mesma
  // sessão. Abrir um encerra o outro; o histórico continua no arquivo da sessão. Só quando o
  // processo vai ser criado: reconectar a um terminal que já roda (modo foco, outra janela,
  // recarregar) não derruba a conversa de ninguém.
  handle('terminal:open', (e, req) => {
    if (!terminals.has(req.key)) {
      chats.close(req.key)
      if (req.sessionId) chats.close(req.sessionId)
    }
    // Antes de abrir: a primeira saída do terminal já encontra a janela na lista.
    viewers.add(e.sender, req.key)
    return terminals.open(req)
  })
  handle('terminal:session', (_e, key) => terminals.sessionOf(key))
  on('terminal:write', (_e, key, data) => terminals.write(key, data))
  on('terminal:resize', (_e, key, cols, rows) => terminals.resize(key, cols, rows))
  on('terminal:kill', (_e, key) => terminals.kill(key))
}
