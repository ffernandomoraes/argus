import { gotoLine } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import type { LineRange } from '../../conversation/fileLinks';
import type { GutterChange } from './gutterChanges';
import { setGitMarks } from './gitGutter';

// Comandos do editor chamados pelo cabeçalho do arquivo e pelos atalhos (fora do CodeMirror).

// Campo "ir para a linha" do CodeMirror (aceita "42" ou "42:10").
export function goToLine(view: EditorView): void {
  gotoLine(view);
}

// Linhas da seleção (sem ela, a do cursor). Seleção que termina no começo de uma linha não conta
// essa linha, como no VS Code.
export function selectedLines(view: EditorView): LineRange {
  const { from, to } = view.state.selection.main;
  const doc = view.state.doc;
  const start = doc.lineAt(from).number;
  const endLine = doc.lineAt(to);
  const end = to > from && to === endLine.from ? Math.max(start, endLine.number - 1) : endLine.number;
  return { start, end };
}

export function showGitMarks(view: EditorView, changes: GutterChange[]): void {
  view.dispatch({ effects: setGitMarks.of(changes) });
}
