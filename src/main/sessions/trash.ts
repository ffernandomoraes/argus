import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { shell } from 'electron'
import { tr } from '../i18n'
import { liveSessions } from '../liveSessions'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// Conversa vai para a Lixeira do sistema: o .jsonl e, se houver, a pasta com o mesmo id (os
// subagentes dela). Some também do `claude --resume`; volta restaurando pela Lixeira.
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
    await shell.trashItem(`${base}.jsonl`)
    await access(base).then(
      () => shell.trashItem(base),
      () => undefined
    )
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
