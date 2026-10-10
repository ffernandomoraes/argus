import { open, stat } from 'node:fs/promises'
import type { FileContent } from '../../shared/files'
import { errorMessage } from '../lib/errors'
import { insideRoot } from '../paths'
import { noPreview } from './preview'

const READ_LIMIT = 1_000_000
// Acima disso nem o primeiro 1 MB aparece: arquivo desse tamanho quase nunca é código.
const PREVIEW_LIMIT = 5_000_000

export async function readFile(root: string, rel: string): Promise<FileContent> {
  const file = insideRoot(root, rel)
  if (!file) return { ok: false, error: 'Caminho fora do projeto.' }
  try {
    const { size } = await stat(file)
    const blocked = noPreview(file, size, PREVIEW_LIMIT, 'pré-visualização')
    if (blocked) return { ok: false, error: blocked }
    const buffer = Buffer.alloc(Math.min(size, READ_LIMIT))
    const handle = await open(file, 'r')
    // Fecha mesmo se a leitura falhar: senão o arquivo ficava aberto até o app fechar.
    try {
      await handle.read(buffer, 0, buffer.length, 0)
    } finally {
      await handle.close()
    }
    // Byte zero nos primeiros 8 KB = arquivo binário (imagem, fonte, zip...).
    if (buffer.subarray(0, 8000).includes(0)) return { ok: false, error: 'Arquivo binário, sem pré-visualização.' }
    return { ok: true, text: buffer.toString('utf8'), size, truncated: size > READ_LIMIT }
  } catch (err) {
    return { ok: false, error: `Não consegui ler o arquivo: ${errorMessage(err)}` }
  }
}
