import { readFile, stat } from 'node:fs/promises'
import { imageType } from '../../shared/imageFiles'

const LIMIT = 30_000_000

// Imagem que o Claude leu (ferramenta Ler), pronta para o <img> do preview. O caminho pode estar
// fora do projeto (print em /tmp), por isso só abre arquivo com extensão de imagem.
export async function readImage(path: string): Promise<string | null> {
  const type = imageType(path)
  if (!type) return null
  try {
    if ((await stat(path)).size > LIMIT) return null
    return `data:${type};base64,${(await readFile(path)).toString('base64')}`
  } catch {
    return null
  }
}
