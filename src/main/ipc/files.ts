import { BrowserWindow } from 'electron'
import {
  copyInto,
  copyToClipboard,
  createItem,
  listDir,
  locateFile,
  openFolder,
  openInBrowser,
  pasteFromClipboard,
  readFile,
  readImage,
  renameItem,
  revealItem,
  trashItem,
  viewItem,
  writeFile
} from '../files'
import { saveUpload } from '../files/upload'
import { unwatchFile, watchFile } from '../fileWatch'
import type { UnsavedFiles } from '../app/unsavedFiles'
import { contentsOf } from './page'
import { fileDiff } from '../gitBranch'
import { handle, on } from './register'

// Arquivos da pasta do projeto, para o painel de código.
export function registerFilesIpc(unsaved: UnsavedFiles): void {
  handle('files:list', (_e, root, rel) => listDir(root, rel))
  handle('files:read', (_e, root, rel) => readFile(root, rel))
  handle('files:locate', (_e, root, rel) => locateFile(root, rel))
  handle('files:image', (_e, path) => readImage(path))
  handle('files:diff', (_e, root, rel) => fileDiff(root, rel))
  handle('files:write', (_e, root, rel, text, base) => writeFile(root, rel, text, base))
  handle('files:create', (_e, root, dir, name, isDir) => createItem(root, dir, name, isDir))
  handle('files:rename', (_e, root, rel, name) => renameItem(root, rel, name))
  handle('files:trash', (_e, root, rel) => trashItem(root, rel))
  handle('files:copy', (_e, root, rels) => copyToClipboard(root, rels))
  handle('files:paste', (_e, root, dir) => pasteFromClipboard(root, dir))
  handle('files:copyInto', (_e, fromRoot, rels, root, dir) => copyInto(fromRoot, rels, root, dir))
  handle('files:upload', (_e, name, data) => saveUpload(name, data))
  on('files:reveal', (_e, root, rel) => revealItem(root, rel))
  on('files:openFolder', (_e, path) => openFolder(path))
  on('files:view', (e, root, rel) => {
    const wc = contentsOf(e.sender)
    void viewItem(wc && BrowserWindow.fromWebContents(wc), root, rel)
  })
  on('files:openInBrowser', (_e, root, rel) => void openInBrowser(root, rel))
  // Um arquivo vigiado por janela: o que está aberto no painel de código.
  on('files:watch', (e, root, rel) => watchFile(e.sender, root, rel))
  on('files:unwatch', (e) => unwatchFile(e.sender))
  on('files:unsaved', (e, has) => unsaved.set(e.sender, has))
}
