import { mkdirSync, writeFileSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cwdsIn } from './cwd'
import { parseLine } from './line'
import { markHolds, readLines, readMark } from './lineReader'
import { mapLimit } from './mapLimit'
import { readSlice } from './read'


function fileWith(body: string | Buffer): string {
  const dir = join(process.env.HOME ?? '', `lines-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir)
  const file = join(dir, 'a.jsonl')
  writeFileSync(file, body)
  return file
}

async function linesOf(file: string, from = 0, to?: number, stopAt?: number) {
  const fh = await open(file, 'r')
  try {
    const size = (await fh.stat()).size
    const got: { text: string; start: number }[] = []
    const read = await readLines(fh, from, to ?? size, (bytes, start) => {
      got.push({ text: bytes.toString('utf8'), start })
      return stopAt !== undefined && got.length === stopAt
    })
    return { got, next: read.next, rest: read.rest.toString('utf8') }
  } finally {
    await fh.close()
  }
}

describe('parseLine', () => {
  it('só aceita objeto JSON; linha cortada, lista ou texto viram null', () => {
    expect(parseLine('{"type":"user"}')).toEqual({ type: 'user' })
    expect(parseLine('{"type":"us')).toBeNull()
    expect(parseLine('[1,2]')).toBeNull()
    expect(parseLine('null')).toBeNull()
    expect(parseLine('')).toBeNull()
  })
})

describe('readLines', () => {
  it('entrega cada linha com onde ela começa, e a última sem "\\n" sobra para depois', async () => {
    const { got, next, rest } = await linesOf(fileWith('{"a":1}\n{"b":2}\n{"c":'))
    expect(got).toEqual([
      { text: '{"a":1}', start: 0 },
      { text: '{"b":2}', start: 8 }
    ])
    expect(next).toBe(16)
    expect(rest).toBe('{"c":')
  })

  // Um print colado deixa a linha com MB: ela é juntada dos pedaços, inteira e na posição certa.
  it('junta linha maior que o pedaço lido de uma vez', async () => {
    const big = `{"img":"${'x'.repeat(300 * 1024)}"}`
    const { got } = await linesOf(fileWith(`{"a":1}\n${big}\n{"b":2}\n`))
    expect(got.map((l) => l.text.length)).toEqual([7, big.length, 7])
    expect(got[2].start).toBe(8 + big.length + 1)
  })

  it('parar no meio devolve de onde continuar', async () => {
    const file = fileWith('{"a":1}\n{"b":2}\n{"c":3}\n')
    const first = await linesOf(file, 0, undefined, 1)
    expect(first.next).toBe(8)
    const second = await linesOf(file, first.next)
    expect(second.got.map((l) => l.text)).toEqual(['{"b":2}', '{"c":3}'])
  })

  it('a posição conta bytes, não letras (acento ocupa dois)', async () => {
    const { got } = await linesOf(fileWith('{"t":"ação"}\n{"b":2}\n'))
    expect(got[1].start).toBe(Buffer.byteLength('{"t":"ação"}\n'))
  })
})

describe('readMark e markHolds', () => {
  it('percebe quando o arquivo foi regravado no lugar da marca', async () => {
    const file = fileWith('{"a":1}\n{"b":2}\n')
    const fh = await open(file, 'r')
    const mark = await readMark(fh, 16, 8)
    expect(await markHolds(fh, 16, mark)).toBe(true)
    await fh.close()
    writeFileSync(file, '{"z":9}\n{"y":8}\n')
    const again = await open(file, 'r')
    expect(await markHolds(again, 16, mark)).toBe(false)
    await again.close()
  })
})

describe('readSlice', () => {
  it('lê só o trecho pedido, e menos quando o arquivo acaba antes', async () => {
    const file = fileWith('0123456789')
    expect(await readSlice(file, 2, 3)).toBe('234')
    expect(await readSlice(file, 8, 100)).toBe('89')
  })
})

describe('cwdsIn', () => {
  it('acha as pastas no texto, inclusive com barra invertida do Windows e aspas escapadas', () => {
    const text = [
      JSON.stringify({ type: 'user', cwd: '/Users/ana/proj' }),
      JSON.stringify({ type: 'user', cwd: 'C:\\Users\\ana\\proj' }),
      JSON.stringify({ type: 'user', cwd: '/x/com "aspas"' })
    ].join('\n')
    expect([...cwdsIn(text)]).toEqual(['/Users/ana/proj', 'C:\\Users\\ana\\proj', '/x/com "aspas"'])
  })

  it('escape cortado no fim do trecho lido fica de fora, sem quebrar', () => {
    expect([...cwdsIn('{"cwd":"C:\\\\Users\\u00"')]).toEqual([])
  })
})

describe('mapLimit', () => {
  it('mantém a ordem da entrada e nunca passa do limite ao mesmo tempo', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([30, 5, 20, 1, 10], 2, async (ms, i) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, ms))
      running--
      return i * 10
    })
    expect(out).toEqual([0, 10, 20, 30, 40])
    expect(peak).toBe(2)
  })

  it('lista vazia não trava', async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([])
  })
})
