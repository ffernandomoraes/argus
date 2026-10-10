import type { FileHandle } from 'node:fs/promises'

// Pedaço lido por vez: começa pequeno (quem só quer as primeiras linhas lê pouco) e dobra até o
// teto. O arquivo de uma conversa longa passa de 100 MB, e ler tudo de uma vez dobra a memória
// do processo principal.
const FIRST_CHUNK = 64 * 1024
const MAX_CHUNK = 4 * 1024 * 1024
const NL = 0x0a

// Recebe cada linha (sem o "\n") e onde ela começa no arquivo. Devolver true interrompe a leitura.
export type LineSink = (bytes: Buffer, start: number) => boolean | void

export type LinesRead = {
  // Logo depois da última linha entregue: de onde a próxima leitura continua.
  next: number
  // O que sobrou sem "\n" no fim: a linha que o Claude Code ainda está gravando, ou a última do
  // arquivo. Vazio quando parou antes do fim.
  rest: Buffer
}

// Entrega as linhas terminadas em "\n" entre `from` e `to`, em pedaços. Linha maior que o pedaço
// (um print em base64) é juntada antes de ser entregue.
export async function readLines(fh: FileHandle, from: number, to: number, onLine: LineSink): Promise<LinesRead> {
  let pos = from
  let lineStart = from
  let chunk = FIRST_CHUNK
  // Pedaços da linha que ainda não terminou.
  let pending: Buffer[] = []
  while (pos < to) {
    const buffer = Buffer.allocUnsafe(Math.min(chunk, to - pos))
    chunk = Math.min(chunk * 2, MAX_CHUNK)
    const { bytesRead } = await fh.read(buffer, 0, buffer.length, pos)
    if (bytesRead === 0) break
    const data = buffer.subarray(0, bytesRead)
    let cut = 0
    for (let nl = data.indexOf(NL); nl !== -1; nl = data.indexOf(NL, cut)) {
      const piece = data.subarray(cut, nl)
      const line = pending.length ? Buffer.concat([...pending, piece]) : piece
      pending = []
      const stop = onLine(line, lineStart)
      lineStart = pos + nl + 1
      cut = nl + 1
      if (stop) return { next: lineStart, rest: Buffer.alloc(0) }
    }
    if (cut < data.length) pending.push(data.subarray(cut))
    pos += bytesRead
  }
  return { next: lineStart, rest: pending.length === 1 ? pending[0] : Buffer.concat(pending) }
}

// Os últimos bytes antes de `end`: servem de marca para saber se o arquivo foi regravado.
export async function readMark(fh: FileHandle, end: number, max: number): Promise<Buffer> {
  const length = Math.min(max, end)
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await fh.read(buffer, 0, length, end - length)
  return buffer.subarray(0, bytesRead)
}

// A marca guardada ainda está no mesmo lugar?
export async function markHolds(fh: FileHandle, end: number, mark: Buffer): Promise<boolean> {
  if (!mark.length) return true
  const now = await readMark(fh, end, mark.length)
  return now.equals(mark)
}
