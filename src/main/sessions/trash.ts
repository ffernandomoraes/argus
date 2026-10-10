import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { shell } from 'electron'
import { liveSessions } from '../liveSessions'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// Conversa vai para a Lixeira do sistema: o .jsonl e, se houver, a pasta com o mesmo id (os
// subagentes dela). Some também do `claude --resume`; volta restaurando pela Lixeira.
// Recusa conversa aberta em algum Claude Code: ele regravaria o arquivo na hora.
export async function trashSession(projectPath: string, id: string): Promise<string | null> {
  if (!isSessionId(id)) return 'Conversa inválida.'
  const live = (await liveSessions()).get(id)
  if (live === 'running' || live === 'needs-you')
    return 'A conversa está em andamento. Interrompa antes de mover para a Lixeira.'
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
