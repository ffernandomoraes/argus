import type { Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { setChanged } from './editorSetup'
import { changedSpan, lineEnds, toDoc, withLf, type LineEnds } from './fileText'

// O arquivo aberto no editor e o texto do disco na última leitura ou gravação (a base): diferente
// do editor = não salvo. `baseText` é a base como está no disco, guardada uma vez, para o rascunho
// não converter o arquivo inteiro a cada tecla. `ends`: o fim de cada linha da base, para salvar
// sem trocar o das linhas que não mudaram.
export type OpenedFile = { view: EditorView; ends: LineEnds; truncated: boolean; base: Text; baseText: string }

// O disco tem um texto novo (lido ou acabado de gravar).
export function setBase(file: OpenedFile, text: string, doc: Text = toDoc(text)): void {
  file.base = doc
  file.baseText = text
  // Sem nenhuma quebra de linha, o texto não diz qual é o fim de linha: fica o de antes.
  file.ends = lineEnds(text, file.ends.main)
}

// Troca o texto do editor pelo do disco: só o trecho que mudou, marcado de verde por um instante
// (mantém a rolagem e o cursor). `alive`: o arquivo continua aberto quando a marca sai.
export function replaceWithDisk(file: OpenedFile, disk: string, alive: () => boolean): void {
  const { view } = file
  const span = changedSpan(view.state.doc.toString(), withLf(disk))
  setBase(file, disk)
  if (!span) return
  view.dispatch({
    changes: span,
    effects: setChanged.of({ from: span.from, to: span.from + span.insert.length })
  })
  setTimeout(() => alive() && view.dispatch({ effects: setChanged.of(null) }), 2500)
}
