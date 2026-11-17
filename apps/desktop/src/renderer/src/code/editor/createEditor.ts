import { basicSetup } from 'codemirror';
import { Compartment, EditorState, Prec, type Extension, type Text } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { changedLines, editorTheme, languageOf, linkedLines } from './editorSetup';
import { editorPhrases } from './editorPhrases';
import { gitGutter } from './gitGutter';
import { mentionTooltip } from './mentionTooltip';

type EditorOptions = {
  // O arquivo veio cortado (só o primeiro 1 MB): sem edição e sem ⌘S, que gravaria só o pedaço
  // lido por cima do arquivo inteiro.
  readOnly: boolean
  onSave: () => void
  onChange: (doc: Text) => void
  // Onde a linguagem do arquivo entra quando carregar.
  language: Compartment
  // Quebra de linha (⌥Z): ligada ou não ao abrir, trocada depois pelo setWrap.
  wrap: Compartment
  wrapped: boolean
};

// O que o editor de código tem, com a coloração do VS Code (Dark+).
export function editorExtensions({ readOnly, onSave, onChange, language, wrap, wrapped }: EditorOptions): Extension[] {
  const save = {
    key: 'Mod-s',
    preventDefault: true,
    run: () => {
      onSave();
      return true;
    },
  };
  return [
    basicSetup,
    keymap.of([...(readOnly ? [] : [save]), indentWithTab]),
    vscodeDark,
    // Na frente do tema do VS Code: fonte e tamanho iguais aos do resto do app.
    Prec.highest(editorTheme),
    linkedLines,
    changedLines,
    gitGutter,
    editorPhrases,
    language.of([]),
    wrap.of(wrapped ? EditorView.lineWrapping : []),
    EditorState.readOnly.of(readOnly),
    EditorView.updateListener.of((u) => u.docChanged && onChange(u.state.doc)),
  ];
}

// Editor de um arquivo; a linguagem chega logo depois (carregada sob demanda).
export function createEditor(
  opts: Omit<EditorOptions, 'language' | 'wrap'> & { parent: HTMLElement; doc: Text; path: string },
): { view: EditorView; destroy: () => void; setWrap: (on: boolean) => void; setMention: (onMention: (() => void) | null) => void } {
  const language = new Compartment();
  const wrap = new Compartment();
  // Botão "Mencionar na conversa" sobre a seleção: só com uma conversa da pasta para receber.
  const mention = new Compartment();
  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({ doc: opts.doc, extensions: [...editorExtensions({ ...opts, language, wrap }), mention.of([])] }),
  });
  let alive = true;
  languageOf(opts.path)
    ?.load()
    .then(
      (support) => alive && view.dispatch({ effects: language.reconfigure(support) }),
      (err: unknown) => console.error('[código] linguagem do editor:', err),
    );
  return {
    view,
    setWrap: (on) => view.dispatch({ effects: wrap.reconfigure(on ? EditorView.lineWrapping : []) }),
    setMention: (onMention) => view.dispatch({ effects: mention.reconfigure(onMention ? mentionTooltip(onMention) : []) }),
    destroy: () => {
      alive = false;
      view.destroy();
    },
  };
}
