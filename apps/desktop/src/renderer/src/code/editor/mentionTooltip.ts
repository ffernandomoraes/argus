import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view';
import { tr } from '../../i18n';
import { keys } from '../../platform';

// Com um trecho escolhido, um botão logo acima dele: "Mencionar na conversa" (o mesmo do ⌘L).
// Escolher de novo ou tirar a seleção move ou esconde o botão.
function tooltipFor(state: EditorState, onMention: () => void): readonly Tooltip[] {
  const range = state.selection.main;
  if (range.empty) return [];
  return [
    {
      pos: range.from,
      above: true,
      strictSide: false,
      arrow: false,
      create: () => {
        const dom = document.createElement('button');
        dom.type = 'button';
        dom.className = 'cm-mention-button';
        dom.textContent = tr('Mencionar na conversa', 'Mention in chat');
        const hint = document.createElement('span');
        hint.className = 'cm-mention-hint';
        hint.textContent = keys('⌘L');
        dom.append(hint);
        // Sem isso, o clique tiraria a seleção do editor antes de ler as linhas.
        dom.addEventListener('mousedown', (e) => e.preventDefault());
        dom.addEventListener('click', () => onMention());
        // O CodeMirror põe a moldura de tooltip no elemento devolvido: ela fica invisível no
        // contêiner, e o botão tem a própria.
        const wrapper = document.createElement('div');
        wrapper.className = 'cm-tooltip-mention';
        wrapper.append(dom);
        return { dom: wrapper };
      },
    },
  ];
}

const theme = EditorView.theme({
  '.cm-tooltip.cm-tooltip-mention': { border: 'none', backgroundColor: 'transparent' },
  '.cm-mention-button': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    padding: '4px 8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-line-strong)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgb(0 0 0 / 0.35)',
    cursor: 'pointer',
  },
  '.cm-mention-button:hover': { backgroundColor: 'var(--color-surface-2)' },
  '.cm-mention-hint': { color: 'var(--color-faint)', fontSize: '11px' },
});

export function mentionTooltip(onMention: () => void): Extension {
  const field = StateField.define<readonly Tooltip[]>({
    create: (state) => tooltipFor(state, onMention),
    update: (tooltips, tr) => (tr.docChanged || tr.selection ? tooltipFor(tr.state, onMention) : tooltips),
    provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
  });
  return [field, theme];
}
