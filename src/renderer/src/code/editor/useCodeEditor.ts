import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import type { FileContent } from '../../../../shared/files'
import { refreshNow } from '../../canvas/sessionsStore'
import type { LineRange } from '../../conversation/fileLinks'
import { getDraft, setDraft } from '../drafts'
import { createEditor } from './createEditor'
import { highlightLines } from './editorSetup'
import { diskChange, fromDoc, lineEnds, toDoc } from './fileText'
import { replaceWithDisk, setBase, type OpenedFile } from './openedFile'

// Só o que importa para a interface: o texto fica no editor.
export type ContentState = Exclude<FileContent, { ok: true }> | { ok: true; truncated: boolean }

// Arquivo aberto no editor (montado em `hostRef`), com o rascunho se houver. ⌘S salva com o fim
// de linha do arquivo. Mudou no disco (`revision` sobe): sem edição pendente, troca só o trecho
// que mudou; com edição pendente, avisa e espera (conflict). O ⌘S também confere o disco: o aviso
// do vigia chega uns instantes depois da mudança, e salvar nesse meio-tempo apagava a edição do
// Claude. Com o aviso na tela, salvar grava por cima (é o que a faixa diz).
export function useCodeEditor(
  hostRef: RefObject<HTMLDivElement | null>,
  { root, path, lines, revision }: { root: string; path: string; lines?: LineRange; revision: number }
) {
  const opened = useRef<OpenedFile | null>(null)
  const [content, setContent] = useState<ContentState | null>(null)
  const [dirty, setDirty] = useState(false)
  // O arquivo mudou no disco enquanto havia edição não salva: não troca o texto sem perguntar.
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
    const file = opened.current
    // Arquivo cortado em 1 MB (só leitura): gravar o pedaço lido cortaria o arquivo no disco.
    if (!file || file.truncated || file.view.state.readOnly) return
    const doc = file.view.state.doc
    if (doc.eq(file.base)) return
    const text = fromDoc(doc, file.base, file.ends)
    const res = await window.api.files.write(root, path, text, conflict ? undefined : file.baseText)
    if (!res.ok && res.conflict) {
      setSaveError(null)
      return setConflict(true)
    }
    if (!res.ok) return setSaveError(res.error)
    setSaveError(null)
    refreshNow(root)
    setBase(file, text, doc)
    setConflict(false)
    // Pode ter digitado enquanto gravava: o rascunho continua se o texto já é outro.
    const stillDirty = !file.view.state.doc.eq(doc)
    setDirty(stillDirty)
    setDraft(root, path, stillDirty ? { base: text, doc: file.view.state.doc } : null)
  }

  const onSaveKey = useEffectEvent(() => void save())
  const latestLines = useEffectEvent(() => lines)

  // Primeira leitura: monta o editor, com o rascunho se houver.
  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | null = null
    window.api.files.read(root, path).then(
      (res) => {
        const parent = hostRef.current
        if (cancelled || !parent) return
        if (!res.ok) return setContent(res)
        setContent({ ok: true, truncated: res.truncated })
        const draft = getDraft(root, path)
        if (draft && draft.base !== res.text) setConflict(true)
        const base = toDoc(res.text)
        let file: OpenedFile | null = null
        const editor = createEditor({
          parent,
          doc: draft?.doc ?? base,
          path,
          readOnly: res.truncated,
          onSave: () => onSaveKey(),
          onChange: (doc) => {
            if (!file) return
            const isDirty = !doc.eq(file.base)
            setDirty(isDirty)
            setDraft(root, path, isDirty ? { base: file.baseText, doc } : null)
          }
        })
        destroy = editor.destroy
        file = { view: editor.view, ends: lineEnds(res.text), truncated: res.truncated, base, baseText: res.text }
        opened.current = file
        setDirty(!!draft && !draft.doc.eq(base))
        const l = latestLines()
        if (l) highlightLines(editor.view, l)
      },
      (err: unknown) => !cancelled && setContent({ ok: false, error: `Não consegui ler o arquivo: ${String(err)}` })
    )
    return () => {
      cancelled = true
      destroy?.()
      opened.current = null
    }
  }, [root, path, hostRef])

  // Link do chat para outras linhas do mesmo arquivo: destaca e rola até elas.
  useEffect(() => {
    const file = opened.current
    if (file && lines) highlightLines(file.view, lines)
  }, [lines])

  // Mudou no disco (o Claude editou, por exemplo). Sem edição pendente, troca só o trecho que
  // mudou e o marca de verde por um instante; com edição pendente, avisa e espera.
  useEffect(() => {
    if (revision === 0) return
    let cancelled = false
    window.api.files.read(root, path).then(
      (res) => {
        const file = opened.current
        if (cancelled || !file || !res.ok || res.truncated) return
        const change = diskChange(file.view.state.doc, file.base, res.text)
        if (change === 'conflict') return setConflict(true)
        if (change === 'replace') return replaceWithDisk(file, res.text, () => opened.current === file)
        setBase(file, res.text, file.view.state.doc)
        setConflict(false)
        setDirty(false)
        setDraft(root, path, null)
      },
      (err: unknown) => console.error('[código] reler arquivo:', err)
    )
    return () => {
      cancelled = true
    }
  }, [root, path, revision])

  // Descarta a edição pendente e fica com o que está no disco. Arquivo que passou de 1 MB aparece
  // cortado e só para leitura (o save não grava arquivo cortado), e o rascunho sai do mesmo jeito:
  // senão ficaria preso, voltando a cada abertura.
  const reloadFromDisk = async () => {
    const res = await window.api.files.read(root, path)
    const file = opened.current
    if (!file || !res.ok) return
    if (res.truncated) {
      file.truncated = true
      setContent({ ok: true, truncated: true })
    }
    setConflict(false)
    replaceWithDisk(file, res.text, () => opened.current === file)
    setDirty(false)
    setDraft(root, path, null)
  }

  return { content, dirty, conflict, saveError, save, reloadFromDisk }
}
