import { RangeSet, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, gutter, GutterMarker } from '@codemirror/view';
import type { GutterChange } from './gutterChanges';

// Margem com as mudanças desde o último commit (verde nova, azul alterada, vermelho apagada), como
// a do VS Code. As marcas acompanham o texto enquanto se digita; voltam a ser calculadas quando o
// arquivo muda no disco (ver useGitMarks).

class ChangeMarker extends GutterMarker {
  constructor(readonly kind: GutterChange['kind']) {
    super();
  }

  override eq(other: ChangeMarker): boolean {
    return other.kind === this.kind;
  }

  override toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = `cm-git-mark cm-git-${this.kind}`;
    return el;
  }
}

const MARKERS = { added: new ChangeMarker('added'), modified: new ChangeMarker('modified'), deleted: new ChangeMarker('deleted') };

export const setGitMarks = StateEffect.define<GutterChange[]>();

const gitMarks = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setGitMarks)) continue;
      const doc = tr.state.doc;
      // A apagada antes da primeira linha fica na primeira.
      const ranges = e.value
        .filter((c) => c.line <= doc.lines)
        .map((c) => MARKERS[c.kind].range(doc.line(Math.max(c.line, 1)).from))
        .sort((a, b) => a.from - b.from);
      marks = RangeSet.of(ranges, true);
    }
    return marks;
  },
});

const theme = EditorView.theme({
  '.cm-git-gutter': { width: '4px', marginRight: '2px' },
  '.cm-git-gutter .cm-gutterElement': { padding: '0', position: 'relative' },
  '.cm-git-mark': { position: 'absolute', inset: '0', width: '3px' },
  '.cm-git-added': { backgroundColor: '#2ea043' },
  '.cm-git-modified': { backgroundColor: '#1b81a8' },
  // Apagadas: um triângulo na base da linha, como no VS Code.
  '.cm-git-deleted': {
    top: 'auto',
    bottom: '-4px',
    height: '0',
    width: '0',
    borderTop: '4px solid transparent',
    borderBottom: '4px solid transparent',
    borderLeft: '4px solid #f85149',
  },
});

export const gitGutter: Extension = [
  gitMarks,
  gutter({ class: 'cm-git-gutter', markers: (view) => view.state.field(gitMarks) }),
  theme,
];
