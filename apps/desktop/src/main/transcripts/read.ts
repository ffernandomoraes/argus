import { closeSync, openSync, readSync } from 'node:fs'
import { open } from 'node:fs/promises'

// Os arquivos das conversas passam de 100 MB: lê só o trecho que interessa.
export async function readSlice(file: string, start: number, length: number): Promise<string> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

// Síncrona: só para conferências pequenas e raras (ver projectDir.ts).
export function readSliceSync(file: string, start: number, length: number): string {
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const bytesRead = readSync(fd, buffer, 0, length, start)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    closeSync(fd)
  }
}
