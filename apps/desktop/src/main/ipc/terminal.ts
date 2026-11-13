import type { TerminalSizes } from '../app/terminalSizes';
import type { TerminalViewers } from '../app/terminalViewers';
import type { Chats } from '../chats';
import type { Terminals } from '../terminals';
import { initDrawerShells, linkDrawerShell, unlinkDrawerShell } from '../terminals/drawerShells';
import { broadcast } from './events';
import { handle, on } from './register';

// Terminais (o `claude` no terminal ou um shell). A saída vai só para as janelas que abriram cada um.
export function registerTerminalIpc(terminals: Terminals, chats: Chats, viewers: TerminalViewers, sizes: TerminalSizes): void {
  // Chat e terminal não ficam abertos juntos na mesma conversa: os dois gravariam na mesma
  // sessão. Abrir um encerra o outro; o histórico continua no arquivo da sessão. Só quando o
  // processo vai ser criado: reconectar a um terminal que já roda (modo foco, outra janela,
  // recarregar) não derruba a conversa de ninguém.
  handle('terminal:open', async (e, req) => {
    if (!terminals.has(req.key)) {
      chats.close(req.key);
      if (req.sessionId) chats.close(req.sessionId);
    }
    // Antes de abrir: a primeira saída do terminal já encontra a janela na lista.
    viewers.add(e.sender, req.key);
    // O tamanho fica com o TerminalSizes (quem abre com o foco vira dono; sem foco, só se não houver).
    const result = await terminals.open({ ...req, keepSize: true });
    sizes.request(e.sender, req.key, req.cols, req.rows, !req.keepSize);
    return result;
  });
  handle('terminal:session', (_e, key) => terminals.sessionOf(key));
  // O que a pessoa digita: o shell do drawer anota, para o Claude saber se ela mexeu depois dele.
  // Quem digita vira o dono do tamanho (ver TerminalSizes).
  on('terminal:write', (e, key, data) => {
    sizes.typed(e.sender, key);
    terminals.input(key, data);
  });
  on('terminal:resize', (e, key, cols, rows) => sizes.request(e.sender, key, cols, rows, false));
  on('terminal:claim', (e, key, cols, rows) => sizes.request(e.sender, key, cols, rows, true));
  on('terminal:kill', (_e, key) => {
    sizes.forget(key);
    terminals.kill(key);
  });
  // Shell do drawer: a conversa de cima digita nele (ver terminals/drawerShells.ts).
  initDrawerShells({
    terminals,
    typed: (key) => broadcast('terminal:typed', key),
    open: (conversations) => broadcast('terminal:openFor', conversations),
  });
  on('terminal:link', (_e, key, conversations) => linkDrawerShell(key, conversations));
  on('terminal:unlink', (_e, key) => unlinkDrawerShell(key));
}
