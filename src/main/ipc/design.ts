import { foldersToRefresh } from '../app/designListChange'
import { commentInPage, escapeInPage, snapshotPage, trackInPage } from '../designPicker'
import { listDesigns, loadDesign, saveDesign, trashDesign } from '../designStore'
import { liveSessions } from '../liveSessions'
import { projectRoutes } from '../projectRoutes'
import { broadcast } from './events'
import { handle, on } from './register'

// Modo design: protótipos guardados em ~/.argus/design e a página do protótipo aberta no drawer.
export function registerDesignIpc(): void {
  handle('design:load', (_e, id) => loadDesign(id))
  // Com o status da conversa de cada protótipo, como a lista das conversas comuns.
  handle('design:list', async (_e, path) => {
    const live = await liveSessions()
    return listDesigns(path).map((d) => ({ ...d, live: d.sessionId ? (live.get(d.sessionId) ?? null) : null }))
  })
  // Design gravado: a lista de conversas da pasta se atualiza, se mudou o que aparece nela.
  handle('design:save', async (_e, design) => {
    const before = loadDesign(design.id)
    const ok = await saveDesign(design)
    if (ok) for (const path of foldersToRefresh(before, design)) broadcast('sessions:changed', path, 'transcript')
    return ok
  })
  // Design apagado: some da lista de conversas da pasta.
  handle('design:trash', async (_e, id) => {
    const projectPath = loadDesign(id)?.projectPath
    const ok = await trashDesign(id)
    if (ok && projectPath) broadcast('sessions:changed', projectPath, 'transcript')
    return ok
  })
  on('design:escape', (e, origin, enabled) => escapeInPage(e.sender, origin, enabled))
  on('design:track', (e, origin) => trackInPage(e.sender, origin))
  on('design:comment', (e, origin, action, id) => commentInPage(e.sender, origin, action, id))
  handle('design:snapshot', (e, origin) => snapshotPage(e.sender, origin))
  handle('design:routes', (_e, path) => projectRoutes(path))
}
