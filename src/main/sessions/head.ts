import { open } from 'node:fs/promises'
import { parseLine } from '../transcripts/line'
import { readLines } from '../transcripts/lineReader'
import { isDesign, isMessage, userText } from './prompt'

// O pedido do modo design é a primeira mensagem: só o começo do arquivo interessa.
const DESIGN_BYTES = 64 * 1024
// Até onde procurar o primeiro pedido com texto. Um print colado na primeira mensagem deixa a
// linha com MB, e ler só os primeiros 64 KB a cortava: a conversa sumia da lista.
const PROMPT_BYTES = 16 * 1024 * 1024

// O começo do arquivo nunca muda (o Claude Code só acrescenta): o que já foi lido dele fica
// guardado por arquivo, e a leitura seguinte continua de onde parou.
export type Head = {
  offset: number
  // Nada mais a procurar: achou o primeiro pedido (e passou da parte do design) ou chegou ao limite.
  done: boolean
  firstPrompt: string | null
  design: boolean
  hasMessages: boolean
}

export const emptyHead = (): Head => ({ offset: 0, done: false, firstPrompt: null, design: false, hasMessages: false })

export async function readHead(file: string, size: number, prev: Head): Promise<Head> {
  if (prev.done || prev.offset >= size) return prev
  const head = { ...prev }
  const visit = (bytes: Buffer, start: number): boolean => {
    const line = parseLine(bytes.toString('utf8'))
    if (!line) return false
    if (start < DESIGN_BYTES && isDesign(line)) head.design = true
    if (isMessage(line)) head.hasMessages = true
    head.firstPrompt ??= userText(line)
    return true
  }
  const found = () => head.firstPrompt !== null && head.offset >= DESIGN_BYTES
  const to = Math.min(size, PROMPT_BYTES)
  const fh = await open(file, 'r')
  try {
    const { next, rest } = await readLines(fh, head.offset, to, (bytes, start) => {
      visit(bytes, start)
      head.offset = start + bytes.length + 1
      return found()
    })
    head.offset = next
    // Última linha do arquivo sem "\n": vale se já estiver inteira; cortada, é lida na próxima vez.
    if (rest.length && to === size && visit(rest, next)) head.offset = size
  } finally {
    await fh.close()
  }
  head.done = found() || size >= PROMPT_BYTES
  return head
}
