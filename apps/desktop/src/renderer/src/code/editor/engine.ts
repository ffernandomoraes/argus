// Tudo do editor que puxa o CodeMirror (~800 KB), num pedaço à parte carregado pelo useCodeEditor.
export { createEditor } from './createEditor'
export { highlightLines } from './editorSetup'
export { diskChange, fromDoc, lineEnds, toDoc } from './fileText'
export { replaceWithDisk, setBase } from './openedFile'
