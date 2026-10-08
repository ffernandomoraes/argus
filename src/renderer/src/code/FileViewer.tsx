import { useEffect, useRef, useState } from 'react'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec, RangeSetBuilder, StateEffect, StateField, Text, type Extension } from '@codemirror/state'
import { Decoration, EditorView, keymap, type DecorationSet } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import type { FileContent, FileDiff } from '../../../shared/files'
import { DiffView } from '../conversation/DiffView'
import type { LineRange } from '../conversation/fileLinks'
import { useEscape } from '../useEscape'
import { CloseCodeButton } from './CodeExplorer'
import { getDraft, setDraft } from './drafts'
import { refreshNow } from '../canvas/sessionsStore'
import { keys } from '../platform'

const ALIASES: Record<string, string> = { mjs: 'js', cjs: 'js', mts: 'ts', cts: 'ts', zsh: 'sh' }

function languageOf(path: string): LanguageDescription | null {
  const name = path.split('/').pop() ?? ''
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return LanguageDescription.matchFilename(languages, ALIASES[ext] ? `x.${ALIASES[ext]}` : name)
}

// Faixas de linhas destacadas: a citada num link do chat (azul) e a que acabou de mudar no disco (verde).
// Ficam presas ao texto: digitar acima delas não as desloca para a linha errada.
const setLinked = StateEffect.define<{ from: number; to: number } | null>()
const setChanged = StateEffect.define<{ from: number; to: number } | null>()

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

const linkedLines = lineMarks(setLinked, 'cm-line-highlight')
const changedLines = lineMarks(setChanged, 'cm-line-changed')

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', backgroundColor: '#1e1e1e' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': { backgroundColor: '#1e1e1e', border: 'none' },
  '.cm-line-highlight': { backgroundColor: 'rgba(96, 165, 250, 0.16)' },
  '.cm-line-changed': { backgroundColor: 'rgba(74, 222, 128, 0.16)' }
})

// Trecho que mudou entre dois textos (começo e fim iguais ficam de fora). Trocar só ele
// mantém a rolagem e o cursor quando o arquivo é recarregado do disco.
function changedSpan(before: string, after: string): { from: number; to: number; insert: string } | null {
  if (before === after) return null
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before[start] === after[start]) start++
  let end = 0
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) }
}

// Arquivo aberto, à direita da árvore no painel de código, num editor com a coloração do VS Code
// (Dark+). ⌘S salva. O que não foi salvo fica como rascunho (drafts.ts) ao trocar de arquivo.
export function FileViewer({
  root,
  path,
  lines,
  diff,
  onDiffChange,
  onClose,
  onCloseCode
}: {
  root: string
  path: string
  // Linhas citadas num link do chat: ficam destacadas e o arquivo abre nelas.
  lines?: LineRange
  // Mostra as mudanças desde o último commit em vez do arquivo; o cabeçalho alterna.
  diff: boolean
  onDiffChange: (diff: boolean) => void
  // ESC fecha só o arquivo (volta para a árvore); o X fecha o painel de código inteiro.
  onClose: () => void
  onCloseCode: () => void
}) {
  // Só o que importa para a interface: o texto fica no editor.
  const [content, setContent] = useState<Exclude<FileContent, { ok: true }> | { ok: true; truncated: boolean } | null>(
    null
  )
  const [dirty, setDirty] = useState(false)
  // O arquivo mudou no disco enquanto havia edição não salva: não troca o texto sem perguntar.
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Texto do disco na última leitura ou gravação; diferente do editor = não salvo.
  const baseRef = useRef<Text>(Text.empty)
  const linesRef = useRef(lines)
  linesRef.current = lines
  // Recarga por mudança no disco.
  const [revision, setRevision] = useState(0)
  useEscape(onClose)

  useEffect(() => {
    window.api.files.watch(root, path)
    const off = window.api.files.onChanged((r, p) => {
      if (r === root && p === path) setRevision((n) => n + 1)
    })
    return () => {
      off()
      window.api.files.unwatch()
    }
  }, [root, path])

  const save = async () => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc
    const res = await window.api.files.write(root, path, doc.toString())
    if (!res.ok) return setSaveError(res.error)
    setSaveError(null)
    refreshNow(root)
    baseRef.current = doc
    setConflict(false)
    // Pode ter digitado enquanto gravava: o rascunho continua se o texto já é outro.
    const stillDirty = !view.state.doc.eq(doc)
    setDirty(stillDirty)
    setDraft(root, path, stillDirty ? { base: doc.toString(), doc: view.state.doc } : null)
  }
  const saveRef = useRef(save)
  saveRef.current = save

  // Primeira leitura: monta o editor, com o rascunho se houver.
  useEffect(() => {
    let cancelled = false
    window.api.files.read(root, path).then((res) => {
      if (cancelled || !hostRef.current) return
      if (!res.ok) return setContent(res)
      setContent({ ok: true, truncated: res.truncated })
      const draft = getDraft(root, path)
      baseRef.current = Text.of(res.text.split('\n'))
      if (draft && draft.base !== res.text) setConflict(true)
      const language = new Compartment()
      const extensions: Extension[] = [
        basicSetup,
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              saveRef.current()
              return true
            }
          },
          indentWithTab
        ]),
        vscodeDark,
        // Na frente do tema do VS Code: fonte e tamanho iguais aos do resto do app.
        Prec.highest(theme),
        linkedLines,
        changedLines,
        language.of([]),
        // Arquivo cortado em 1 MB: salvar gravaria só o pedaço lido.
        EditorState.readOnly.of(res.truncated),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return
          const isDirty = !u.state.doc.eq(baseRef.current)
          setDirty(isDirty)
          setDraft(root, path, isDirty ? { base: baseRef.current.toString(), doc: u.state.doc } : null)
        })
      ]
      const view = new EditorView({
        parent: hostRef.current,
        state: EditorState.create({ doc: draft?.doc ?? baseRef.current, extensions })
      })
      viewRef.current = view
      setDirty(!!draft && !draft.doc.eq(baseRef.current))
      languageOf(path)
        ?.load()
        .then((support) => !cancelled && view.dispatch({ effects: language.reconfigure(support) }))
      const l = linesRef.current
      if (l) highlightLines(view, l)
    })
    return () => {
      cancelled = true
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [root, path])

  // Link do chat para outras linhas do mesmo arquivo: destaca e rola até elas.
  useEffect(() => {
    if (viewRef.current && lines) highlightLines(viewRef.current, lines)
  }, [lines])

  // Mudou no disco (o Claude editou, por exemplo). Sem edição pendente, troca só o trecho que
  // mudou e o marca de verde por um instante; com edição pendente, avisa e espera.
  useEffect(() => {
    if (revision === 0) return
    let cancelled = false
    window.api.files.read(root, path).then((res) => {
      const view = viewRef.current
      if (cancelled || !view || !res.ok || res.truncated) return
      const current = view.state.doc.toString()
      if (current === res.text) {
        baseRef.current = view.state.doc
        setConflict(false)
        setDirty(false)
        setDraft(root, path, null)
        return
      }
      if (!view.state.doc.eq(baseRef.current)) return setConflict(true)
      replaceWithDisk(view, current, res.text)
    })
    return () => {
      cancelled = true
    }
  }, [root, path, revision])

  const replaceWithDisk = (view: EditorView, current: string, disk: string) => {
    const span = changedSpan(current, disk)
    baseRef.current = Text.of(disk.split('\n'))
    if (!span) return
    view.dispatch({
      changes: span,
      effects: setChanged.of({ from: span.from, to: span.from + span.insert.length })
    })
    setTimeout(() => viewRef.current === view && view.dispatch({ effects: setChanged.of(null) }), 2500)
  }

  // Descarta a edição pendente e fica com o que está no disco.
  const reloadFromDisk = async () => {
    const res = await window.api.files.read(root, path)
    const view = viewRef.current
    if (!view || !res.ok) return
    setConflict(false)
    replaceWithDisk(view, view.state.doc.toString(), res.text)
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
      <header className="flex h-12 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="min-w-0 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </span>
        {dirty && (
          <span className="shrink-0 text-[12px] text-faint" title="Alterações não salvas">
            ● não salvo - {keys('⌘S')}
          </span>
        )}
        <span className="flex-1" />
        {!diff && content?.ok && content.truncated && (
          <span className="text-[12px] text-needs-you">mostrando só o primeiro 1 MB, sem edição</span>
        )}
        <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
          {[
            { value: true, label: 'Diff' },
            { value: false, label: 'Arquivo' }
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => onDiffChange(o.value)}
              aria-pressed={diff === o.value}
              className={`rounded-md px-2 py-0.5 ${diff === o.value ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <CloseCodeButton onClick={onCloseCode} />
      </header>
      {!diff && conflict && (
        <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 text-[12px] text-needs-you">
          <span className="flex-1">O arquivo mudou no disco depois da sua edição. Salvar sobrescreve a versão do disco.</span>
          <button onClick={reloadFromDisk} className="rounded-md px-2 py-0.5 text-text hover:bg-surface-2">
            Descartar a minha e recarregar
          </button>
        </div>
      )}
      {!diff && saveError && (
        <p role="alert" className="border-b border-line bg-surface px-3 py-2 text-[12px] text-red-400">
          Não consegui salvar: {saveError}
        </p>
      )}
      {diff && <DiffPane root={root} path={path} revision={revision} />}
      {/* Fica montado no modo Diff: o editor mantém cursor, rolagem e desfazer. */}
      <div className={`min-h-0 flex-1 ${diff ? 'hidden' : 'flex flex-col'}`}>
        {!content && <p className="p-4 text-xs text-faint">Carregando…</p>}
        {content && !content.ok && <p className="p-4 text-xs text-faint">{content.error}</p>}
        <div ref={hostRef} className={`code-editor min-h-0 flex-1 select-text ${content?.ok ? '' : 'hidden'}`} />
      </div>
    </section>
  )
}

function highlightLines(view: EditorView, lines: LineRange) {
  const doc = view.state.doc
  const first = doc.line(Math.min(Math.max(lines.start, 1), doc.lines))
  const last = doc.line(Math.min(Math.max(lines.end, lines.start, 1), doc.lines))
  view.dispatch({
    effects: [setLinked.of({ from: first.from, to: last.from }), EditorView.scrollIntoView(first.from, { y: 'center' })]
  })
}

// Mudanças do arquivo desde o último commit. Relê quando o arquivo muda no disco (revision).
function DiffPane({ root, path, revision }: { root: string; path: string; revision: number }) {
  const [result, setResult] = useState<FileDiff | null>(null)
  useEffect(() => {
    let cancelled = false
    window.api.files.diff(root, path).then((res) => !cancelled && setResult(res))
    return () => {
      cancelled = true
    }
  }, [root, path, revision])

  return (
    <div className="min-h-0 flex-1 overflow-auto select-text">
      {!result && <p className="p-4 text-xs text-faint">Carregando…</p>}
      {result && !result.ok && <p className="p-4 text-xs text-faint">{result.error}</p>}
      {result?.ok && result.hunks.length === 0 && (
        <p className="p-4 text-xs text-faint">Sem mudanças desde o último commit.</p>
      )}
      {result?.ok && result.hunks.length > 0 && <DiffView hunks={result.hunks} full />}
    </div>
  )
}
