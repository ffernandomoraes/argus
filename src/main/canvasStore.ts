import { readFileSync, renameSync, writeFileSync } from 'node:fs'
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

// Fechando o app: grava na hora, sem esperar a fila (o processo sai logo em seguida).
export function saveCanvasNow(data: unknown): void {
  try {
    const tmp = file() + '.tmp'
    writeFileSync(tmp, JSON.stringify(data))
    renameSync(tmp, file())
  } catch {
    // Sem gravar, fica o último salvamento.
  }
}
