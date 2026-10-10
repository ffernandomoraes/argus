import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import type { LineRange } from '../../conversation/fileLinks'

const ALIASES: Record<string, string> = { mjs: 'js', cjs: 'js', mts: 'ts', cts: 'ts', zsh: 'sh' }

export function languageOf(path: string): LanguageDescription | null {
  const name = path.split('/').pop() ?? ''
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return LanguageDescription.matchFilename(languages, ALIASES[ext] ? `x.${ALIASES[ext]}` : name)
}

// Faixas de linhas destacadas: a citada num link do chat (azul) e a que acabou de mudar no disco (verde).
// Ficam presas ao texto: digitar acima delas não as desloca para a linha errada.
const setLinked = StateEffect.define<{ from: number; to: number } | null>()
export const setChanged = StateEffect.define<{ from: number; to: number } | null>()

function lineMarks(effect: typeof setLinked, className: string) {
  const mark = Decoration.line({ class: className })
  return StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(marks, tr) {
      marks = marks.map(tr.changes)
      for (const e of tr.effects) {
        if (!e.is(effect)) continue
        if (!e.value) return Decoration.none
        const builder = new RangeSetBuilder<Decoration>()
        const doc = tr.state.doc
        const last = doc.lineAt(Math.min(e.value.to, doc.length)).number
        for (let n = doc.lineAt(e.value.from).number; n <= last; n++) builder.add(doc.line(n).from, doc.line(n).from, mark)
        marks = builder.finish()
      }
      return marks
    },
    provide: (f) => EditorView.decorations.from(f)
  })
}

export const linkedLines = lineMarks(setLinked, 'cm-line-highlight')
export const changedLines = lineMarks(setChanged, 'cm-line-changed')

// Na frente do tema do VS Code: fonte e tamanho iguais aos do resto do app.
export const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', backgroundColor: '#1e1e1e' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', border: 'none' },
  '.cm-line-highlight': { backgroundColor: 'rgba(96, 165, 250, 0.16)' },
  '.cm-line-changed': { backgroundColor: 'rgba(74, 222, 128, 0.16)' }
})

// Destaca as linhas citadas num link do chat e rola até elas.
export function highlightLines(view: EditorView, lines: LineRange) {
  const doc = view.state.doc
  const first = doc.line(Math.min(Math.max(lines.start, 1), doc.lines))
  const last = doc.line(Math.min(Math.max(lines.end, lines.start, 1), doc.lines))
  view.dispatch({
    effects: [setLinked.of({ from: first.from, to: last.from }), EditorView.scrollIntoView(first.from, { y: 'center' })]
  })
}
