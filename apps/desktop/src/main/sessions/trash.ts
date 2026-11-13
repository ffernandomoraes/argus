import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { tr } from '../i18n'
import { liveSessions } from '../liveSessions'
import { isSessionId, projectDir } from '../transcripts/projectDir'
import { distroFor, trashPath } from '../wsl'
import { removeSessionLeftovers } from './leftovers'

// Conversa vai para a Lixeira do sistema: o .jsonl e, se houver, a pasta com o mesmo id (os
// subagentes dela). Some também do `claude --resume`; volta restaurando pela Lixeira. Projeto do
// WSL: a Lixeira do Linux (ver wsl/trash.ts). O resto que o Claude Code guardou dela (rascunhos,
// pontos de restauração, ambiente do shell) é apagado de vez (ver leftovers.ts); no WSL fica, porque
// mora dentro do Linux.
// Recusa conversa aberta em algum Claude Code: ele regravaria o arquivo na hora.
export async function trashSession(projectPath: string, id: string): Promise<string | null> {
  if (!isSessionId(id)) return tr('Conversa inválida.', 'Invalid chat.')
  const live = (await liveSessions()).get(id)
  if (live === 'running' || live === 'needs-you')
    return tr(
      'A conversa está em andamento. Interrompa antes de mover para a Lixeira.',
      'This chat is still running. Stop it before moving it to the Trash.'
    )
  const base = join(projectDir(projectPath), id)
  try {
    await trashPath(`${base}.jsonl`)
    await access(base).then(
      () => trashPath(base),
      () => undefined
    )
    if (!distroFor(projectPath)) await removeSessionLeftovers(id)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
