import {
  copyToClipboard,
  createItem,
  listDir,
  pasteFromClipboard,
  readFile,
  renameItem,
  revealItem,
  trashItem,
  writeFile
} from '../files'
import { unwatchFile, watchFile } from '../fileWatch'
import type { UnsavedFiles } from '../app/unsavedFiles'
import { fileDiff } from '../gitBranch'
import { handle, on } from './register'

// Arquivos da pasta do projeto, para o painel de código.
export function registerFilesIpc(unsaved: UnsavedFiles): void {
  handle('files:list', (_e, root, rel) => listDir(root, rel))
  handle('files:read', (_e, root, rel) => readFile(root, rel))
  handle('files:diff', (_e, root, rel) => fileDiff(root, rel))
  handle('files:write', (_e, root, rel, text, base) => writeFile(root, rel, text, base))
  handle('files:create', (_e, root, dir, name, isDir) => createItem(root, dir, name, isDir))
  handle('files:rename', (_e, root, rel, name) => renameItem(root, rel, name))
  handle('files:trash', (_e, root, rel) => trashItem(root, rel))
  handle('files:copy', (_e, root, rels) => copyToClipboard(root, rels))
  handle('files:paste', (_e, root, dir) => pasteFromClipboard(root, dir))
  on('files:reveal', (_e, root, rel) => revealItem(root, rel))
  // Um arquivo vigiado por janela: o que está aberto no painel de código.
  on('files:watch', (e, root, rel) => watchFile(e.sender, root, rel))
  on('files:unwatch', (e) => unwatchFile(e.sender))
  on('files:unsaved', (e, has) => unsaved.set(e.sender, has))
}
