import { statfs } from 'node:fs/promises'
import type { DiskInfo, DiskLevel } from '../../shared/systemHealth'

// Espaço livre no disco dos dados do Argus (canvas, configurações). As conversas do Claude ficam na
// pasta pessoal, que quase sempre está no mesmo disco.

const GB = 1024 ** 3
// Com menos que isso livre, cheio: gravar começa a falhar.
const FULL_BYTES = 1 * GB
// Com menos que isso, quase cheio: o aviso amarelo.
const LOW_BYTES = 5 * GB
// Para sair de um nível, um pouco acima do limite (ver o MARGIN da memória).
const MARGIN_BYTES = GB / 2

export function diskLevel(freeBytes: number, previous: DiskLevel = 'ok'): DiskLevel {
  if (freeBytes < (previous === 'full' ? FULL_BYTES + MARGIN_BYTES : FULL_BYTES)) return 'full'
  if (freeBytes < (previous === 'ok' ? LOW_BYTES : LOW_BYTES + MARGIN_BYTES)) return 'low'
  return 'ok'
}

// Nulo: não deu para ler.
export async function readDisk(path: string, previous?: DiskLevel): Promise<DiskInfo | null> {
  try {
    const s = await statfs(path)
    const freeBytes = s.bavail * s.bsize
    return { freeBytes, totalBytes: s.blocks * s.bsize, level: diskLevel(freeBytes, previous) }
  } catch {
    return null
  }
}
