import type { DiffHunk } from '@argus/shared/history';

// Marca de uma linha na margem do editor, como no VS Code: linha nova (verde), alterada (azul) ou
// linhas apagadas logo abaixo desta (vermelho). Linha 0: apagadas antes da primeira.
export type GutterChange = { line: number; kind: 'added' | 'modified' | 'deleted' };

// Trechos do diff contra o último commit → marca de cada linha do arquivo como está agora.
// Linha nova logo depois de linhas apagadas é "alterada"; apagada sem nova no lugar marca a linha de
// cima.
export function gutterChanges(hunks: readonly DiffHunk[]): GutterChange[] {
  const out: GutterChange[] = [];
  for (const hunk of hunks) {
    let line = hunk.newStart;
    let removed = 0;
    const flush = () => {
      if (removed) out.push({ line: Math.max(line - 1, 0), kind: 'deleted' });
      removed = 0;
    };
    for (const text of hunk.lines) {
      if (text.startsWith('-')) {
        removed++;
      } else if (text.startsWith('+')) {
        out.push({ line, kind: removed ? 'modified' : 'added' });
        if (removed) removed--;
        line++;
      } else {
        flush();
        line++;
      }
    }
    flush();
  }
  return out;
}
