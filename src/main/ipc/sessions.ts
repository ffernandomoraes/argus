import { shell } from 'electron'
import { WatchedFolders } from '../app/watchedFolders'
import { designSessionIds } from '../designStore'
import { checkoutBranch, currentBranch, fetchBranches, listBranches, repoUrl, uncommittedFiles } from '../gitBranch'
import { readHistory, readImages } from '../history'
import type { SessionWatch } from '../sessionWatch'
import { listKnownFolders, listSessions, sessionContext, trashSession } from '../sessions'
import { conversationsIn, indexEntry, isAgentConversation, loadConversation, loadImages, trashConversation } from '../agentChats/store'
import type { SessionSummary } from '../../shared/sessions'
import { agentRef } from '../../shared/providers'
import { handle, on } from './register'

// Conversas do Claude Code em cada pasta, o git dela e a vigia que avisa quando algo muda.
export function registerSessionsIpc(sessionWatch: SessionWatch): void {
  const watched = new WatchedFolders((paths) => sessionWatch.setProjects(paths))
  handle('sessions:list', async (_e, path) => {
    // A conversa de um protótipo faz parte do design dele, que já está na lista: não aparece solta.
    const sessions = [...(await listSessions(path)), ...agentSessions(path)]
    const inDesigns = designSessionIds(path)
    return inDesigns.size ? sessions.filter((s) => !inDesigns.has(s.id)) : sessions
  })
  handle('sessions:folders', () => listKnownFolders())
  handle('sessions:trash', (_e, path, id) => (isAgentConversation(id) ? trashConversation(id) : trashSession(path, id)))
  handle('sessions:branch', (_e, path) => currentBranch(path))
  handle('sessions:branches', (_e, path) => listBranches(path))
  handle('sessions:fetch', (_e, path) => fetchBranches(path))
  handle('sessions:checkout', (_e, path, option, create) => checkoutBranch(path, option, create))
  handle('sessions:repoUrl', (_e, path) => repoUrl(path))
  // Abre o endereço calculado aqui, não um que venha da tela.
  on('sessions:openRepo', async (_e, path) => {
    const url = await repoUrl(path)
    if (url) await shell.openExternal(url)
  })
  handle('sessions:changes', (_e, path) => uncommittedFiles(path))
  on('sessions:watch', (e, paths) => watched.set(e.sender, paths))
  handle('sessions:history', async (_e, path, id) => (isAgentConversation(id) ? (loadConversation(id)?.messages ?? []) : readHistory(path, id)))
  handle('sessions:context', async (_e, path, id) => (isAgentConversation(id) ? (indexEntry(id)?.contextPercent ?? 0) : sessionContext(path, id)))
  handle('sessions:images', async (_e, path, id, messageId) => (isAgentConversation(id) ? loadImages(id, messageId) : readImages(path, id, messageId)))
}

// Conversas com Codex, Gemini e Cursor nesta pasta, gravadas pelo Argus (ver agentChats/store.ts).
function agentSessions(path: string): SessionSummary[] {
  return conversationsIn(path).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    repliedAt: c.repliedAt ?? c.updatedAt,
    contextPercent: c.contextPercent,
    live: null,
    agent: agentRef(c.provider, c.account),
    ...(c.design && { design: true })
  }))
}
