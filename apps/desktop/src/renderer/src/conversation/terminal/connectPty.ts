import type { TerminalOpenRequest } from '@argus/shared/terminal';
import type { Xterm } from './createXterm';
import { createPtySize } from './ptySize';

export type PtyRequest = Omit<TerminalOpenRequest, 'cols' | 'rows' | 'keepSize'>;

// Liga o xterm ao processo do terminal (no processo principal) pela chave da sessão: abre (ou
// reconecta) o processo, escreve a saída, manda o que se digita e acompanha o tamanho. Devolve
// como desligar; o processo continua vivo.
export function connectPty(
  xterm: Pick<Xterm, 'term' | 'follow'>,
  req: PtyRequest,
  events: { onError: (error: string) => void; onExit: (code: number) => void },
): () => void {
  const api = window.api.terminal;
  const { term } = xterm;
  const { key } = req;
  let disposed = false;
  // Até a resposta do open, o que chega já está no buffer que ela devolve (o processo guarda a
  // saída para redesenhar a tela ao reconectar): escrever as duas coisas repetia o começo.
  let opened = false;
  const offData = api.onData(key, (data) => {
    if (opened) term.write(data);
  });
  // Antes da resposta do open, o fim é do processo anterior na mesma chave (trocar a conta encerra
  // o `claude` e abre outro logo depois): não é deste, que acabou de abrir.
  const offExit = api.onExit((k, code) => {
    if (k === key && opened) events.onExit(code);
  });
  const input = term.onData((data) => api.write(key, data));

  // O processo tem um tamanho só, e o mesmo terminal pode estar em mais de uma página (o canvas em
  // dois monitores, o notebook pelo acesso remoto). Manda quem clicou ou digitou por último (ver
  // TerminalSizes no processo principal); as outras desenham no tamanho dele, sem se encaixar, até
  // a pessoa clicar nelas. Sem isso, a outra recebia um desenho de outra largura e embaralhava.
  const size = createPtySize((cols, rows) => api.resize(key, cols, rows));
  let following = false;
  const offSize = api.onSize(key, (cols, rows, mine) => {
    if (mine) {
      if (!following) return;
      following = false;
      xterm.follow(null);
      size.now(term.cols, term.rows);
    } else {
      following = true;
      size.mark(cols, rows);
      xterm.follow({ cols, rows });
    }
  });
  const focused = document.hasFocus();
  if (focused) size.mark(term.cols, term.rows);
  api
    .open({ ...req, cols: term.cols, rows: term.rows, keepSize: !focused })
    .then(
      (res) => {
        if (disposed) return;
        opened = true;
        if (!res.ok) events.onError(res.error);
        else if (res.buffer) term.write(res.buffer);
      },
      (err: unknown) => {
        // Sem resposta, a saída que chegar segue aparecendo, como antes.
        opened = true;
        console.error('[terminal] falha ao abrir:', err);
      },
    );

  // Colunas e linhas mudaram (borda do bloco, fonte): manda depois que pararem de mudar. Seguindo
  // outra página, a mudança veio do tamanho dela: não manda.
  const resized = term.onResize(({ cols, rows }) => {
    if (!following) size.schedule(cols, rows);
  });

  // Clicou no terminal: esta página volta a se encaixar e passa a mandar no tamanho.
  const takeSize = () => {
    if (following) {
      following = false;
      xterm.follow(null);
    }
    size.mark(term.cols, term.rows);
    api.claim(key, term.cols, term.rows);
  };
  term.textarea?.addEventListener('focus', takeSize);

  return () => {
    disposed = true;
    size.dispose();
    offSize();
    term.textarea?.removeEventListener('focus', takeSize);
    resized.dispose();
    input.dispose();
    offData();
    offExit();
  };
}
