import { readFileSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

// Grupos, pastas e posições do canvas, num JSON nos dados do app.
const file = () => join(app.getPath('userData'), 'canvas.json')

export function loadCanvas(): unknown {
  try {
    return JSON.parse(readFileSync(file(), 'utf8'))
  } catch {
    return null
  }
}

// Grava num temporário e troca: fechar o app no meio não corrompe o arquivo.
let pending = Promise.resolve()
export function saveCanvas(data: unknown): Promise<void> {
  pending = pending.then(async () => {
    const tmp = file() + '.tmp'
    await writeFile(tmp, JSON.stringify(data))
    await rename(tmp, file())
  }).catch(() => {})
  return pending
}
