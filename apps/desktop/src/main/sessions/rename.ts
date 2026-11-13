import { appendFile, open } from 'node:fs/promises'
import { join } from 'node:path'
import { cleanTitle } from '@argus/shared/chat'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { isSessionId, projectDir } from '../transcripts/projectDir'

// Termina em quebra de linha? Arquivo cortado no meio de uma linha juntaria a nossa com ela.
async function endsWithNewline(file: string): Promise<boolean> {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    if (size === 0) return true
    const last = Buffer.alloc(1)
    await handle.read(last, 0, 1, size - 1)
    return last[0] === 0x0a
  } finally {
    await handle.close()
  }
}

// Conversa do Claude fechada: a mesma linha que o /rename do Claude Code grava no fim do arquivo
// (conferido na 2.1.322). Vale para o Argus (sessions/tail.ts) e para o `claude --resume`.
// Conversa aberta num Claude Code regravaria o título antigo que ele guarda: essa vai pelo pedido
// do SDK (ChatSession.rename) ou pelo /rename no terminal dela.
export async function renameSessionFile(projectPath: string, id: string, title: string): Promise<string | null> {
  if (!isSessionId(id)) return tr('Conversa inválida.', 'Invalid chat.')
  const name = cleanTitle(title)
  if (!name) return tr('O nome não pode ficar vazio.', 'The name cannot be empty.')
  const file = join(projectDir(projectPath), `${id}.jsonl`)
  try {
    // Arquivo que não existe falha no open de endsWithNewline: nada de criar conversa nova.
    const line = JSON.stringify({ type: 'custom-title', customTitle: name, sessionId: id })
    await appendFile(file, `${(await endsWithNewline(file)) ? '' : '\n'}${line}\n`)
    return null
  } catch (err) {
    return errorMessage(err)
  }
}
