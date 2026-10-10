import { shell } from 'electron'
import { WatchedFolders } from '../app/watchedFolders'
import { designSessionIds } from '../designStore'
import { currentBranch, repoUrl, uncommittedFiles } from '../gitBranch'
import { readHistory, readImages } from '../history'
import type { SessionWatch } from '../sessionWatch'
import { listKnownFolders, listSessions, sessionContext, trashSession } from '../sessions'
import { handle, on } from './register'

// Conversas do Claude Code em cada pasta, o git dela e a vigia que avisa quando algo muda.
export function registerSessionsIpc(sessionWatch: SessionWatch): void {
  const watched = new WatchedFolders((paths) => sessionWatch.setProjects(paths))
  handle('sessions:list', async (_e, path) => {
    // A conversa de um protótipo faz parte do design dele, que já está na lista: não aparece solta.
    const sessions = await listSessions(path)
    const inDesigns = designSessionIds(path)
    return inDesigns.size ? sessions.filter((s) => !inDesigns.has(s.id)) : sessions
  })
  handle('sessions:folders', () => listKnownFolders())
  handle('sessions:trash', (_e, path, id) => trashSession(path, id))
  handle('sessions:branch', (_e, path) => currentBranch(path))
  handle('sessions:repoUrl', (_e, path) => repoUrl(path))
  // Abre o endereço calculado aqui, não um que venha da tela.
  on('sessions:openRepo', async (_e, path) => {
    const url = await repoUrl(path)
    if (url) await shell.openExternal(url)
  })
  handle('sessions:changes', (_e, path) => uncommittedFiles(path))
  on('sessions:watch', (e, paths) => watched.set(e.sender, paths))
  handle('sessions:history', (_e, path, id) => readHistory(path, id))
  handle('sessions:context', (_e, path, id) => sessionContext(path, id))
  handle('sessions:images', (_e, path, id, messageId) => readImages(path, id, messageId))
}
