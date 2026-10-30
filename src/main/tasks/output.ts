import { open, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import type { TaskOutputChunk, TaskOutputRef } from '../../shared/backgroundTasks'
import { IS_WIN } from '../platform'
import { isSessionId } from '../transcripts/projectDir'

// Saída das tarefas em segundo plano: o Claude Code grava cada uma num arquivo de texto
// (<temp>/claude-<uid>/<pasta achatada>/<sessão>/tasks/<id>.output) que cresce enquanto ela roda.

// Ao abrir, só o fim de uma saída enorme (um servidor rodando há horas): o terminal guarda 5000
// linhas de qualquer jeito.
const FIRST_MAX = 512 * 1024
// A cada leitura, no máximo isto; o resto vem na próxima.
const READ_MAX = 1024 * 1024

const flatten = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-')

// Só arquivos de saída de tarefa: <...>/tasks/<id>.output, caminho absoluto sem "..". O caminho vem
// da tela (que leu do resultado do comando).
function isOutputFile(file: string, taskId: string): boolean {
  return isAbsolute(file) && normalize(file) === file && basename(file) === `${taskId}.output` && basename(dirname(file)) === 'tasks'
}

// Pastas onde o Claude Code pode ter gravado: a pedida pela variável dele, o /tmp (Mac e Linux) e a
// temporária do sistema (Windows). Também são as dos rascunhos do agente (ver storage/scratch.ts).
export function tempRoots(): string[] {
  const roots = [process.env.CLAUDE_CODE_TMPDIR, IS_WIN ? undefined : '/tmp', tmpdir()].filter((r): r is string => !!r)
  const user = IS_WIN ? 'claude' : `claude-${process.getuid?.() ?? ''}`
  return [...new Set(roots)].flatMap((r) => [join(r, user), join(r, 'claude')])
}

const exists = (file: string) => stat(file).then((s) => s.isFile(), () => false)

// Arquivo da saída da tarefa; nulo se não deu para achar.
export async function taskOutputFile(ref: TaskOutputRef): Promise<string | null> {
  if (!isSessionId(ref.taskId) || !isSessionId(ref.sessionId)) return null
  if (ref.outputFile) return isOutputFile(ref.outputFile, ref.taskId) ? ref.outputFile : null
  for (const root of tempRoots()) {
    const file = join(root, flatten(ref.cwd), ref.sessionId, 'tasks', `${ref.taskId}.output`)
    if (await exists(file)) return file
  }
  return null
}

// O que a saída ganhou desde `offset`. Leitura que começa do zero pega só o fim (FIRST_MAX).
export async function readTaskOutput(ref: TaskOutputRef, offset: number): Promise<TaskOutputChunk> {
  const file = await taskOutputFile(ref)
  const info = file ? await stat(file).catch(() => null) : null
  if (!file || !info?.isFile()) return { text: '', offset: 0, reset: offset > 0, missing: true }
  const reset = info.size < offset
  let start = reset ? 0 : offset
  if (start === 0 && info.size > FIRST_MAX) start = info.size - FIRST_MAX
  const end = Math.min(info.size, start + READ_MAX)
  if (end <= start) return { text: '', offset: start, reset, missing: false }
  const fh = await open(file, 'r')
  try {
    const bytes = Buffer.alloc(end - start)
    await fh.read(bytes, 0, bytes.length, start)
    // Caractere cortado no fim (ainda sendo gravado): fica para a próxima leitura.
    const whole = completeUtf8(bytes)
    return { text: whole.toString('utf8'), offset: start + whole.length, reset, missing: false }
  } finally {
    await fh.close()
  }
}

// Os bytes até o último caractere UTF-8 inteiro.
export function completeUtf8(bytes: Buffer): Buffer {
  let i = bytes.length - 1
  // Volta até o começo do último caractere (no máximo 3 bytes de continuação).
  while (i >= 0 && bytes.length - i <= 4 && (bytes[i] & 0xc0) === 0x80) i--
  if (i < 0) return bytes
  const lead = bytes[i]
  const size = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1
  return bytes.length - i < size ? bytes.subarray(0, i) : bytes
}
