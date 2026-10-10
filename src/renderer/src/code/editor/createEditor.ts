import { basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec, type Extension, type Text } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { changedLines, editorTheme, languageOf, linkedLines } from './editorSetup'

type EditorOptions = {
  // O arquivo veio cortado (só o primeiro 1 MB): sem edição e sem ⌘S, que gravaria só o pedaço
  // lido por cima do arquivo inteiro.
  readOnly: boolean
  onSave: () => void
  onChange: (doc: Text) => void
  // Onde a linguagem do arquivo entra quando carregar.
  language: Compartment
}

// O que o editor de código tem, com a coloração do VS Code (Dark+).
export function editorExtensions({ readOnly, onSave, onChange, language }: EditorOptions): Extension[] {
  const save = {
    key: 'Mod-s',
    preventDefault: true,
    run: () => {
      onSave()
      return true
    }
  }
  return [
    basicSetup,
    keymap.of([...(readOnly ? [] : [save]), indentWithTab]),
    vscodeDark,
    // Na frente do tema do VS Code: fonte e tamanho iguais aos do resto do app.
    Prec.highest(editorTheme),
    linkedLines,
    changedLines,
    language.of([]),
    EditorState.readOnly.of(readOnly),
    EditorView.updateListener.of((u) => u.docChanged && onChange(u.state.doc))
  ]
}

// Editor de um arquivo; a linguagem chega logo depois (carregada sob demanda).
export function createEditor(
  opts: Omit<EditorOptions, 'language'> & { parent: HTMLElement; doc: Text; path: string }
): { view: EditorView; destroy: () => void } {
  const language = new Compartment()
  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({ doc: opts.doc, extensions: editorExtensions({ ...opts, language }) })
  })
  let alive = true
  languageOf(opts.path)
    ?.load()
    .then(
      (support) => alive && view.dispatch({ effects: language.reconfigure(support) }),
      (err: unknown) => console.error('[código] linguagem do editor:', err)
    )
  return {
    view,
    destroy: () => {
      alive = false
      view.destroy()
    }
  }
}
