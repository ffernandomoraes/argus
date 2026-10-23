import { appendFileSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assistant, text, user } from '../../../test/transcript'
import { loadTranscript } from './cache'

// O arquivo da conversa é lido uma vez e depois só o que o Claude Code acrescenta. O risco é a tela
// mostrar mensagem repetida, faltando, ou a conversa antiga depois de o arquivo ser regravado.

const jsonl = (lines: object[]) => lines.map((l) => JSON.stringify(l) + '\n').join('')

function newFile(lines: object[]): string {
  const file = join(mkdtempSync(join(process.env.HOME ?? '', 'cache-')), 'session.jsonl')
  writeFileSync(file, jsonl(lines))
  return file
}

const textsOf = async (file: string) => {
  const t = await loadTranscript(file)
  return t?.history.messages().map((m) => ('text' in m ? m.text : m.role))
}

describe('loadTranscript', () => {
  it('lê a conversa e, depois, só as linhas novas, sem repetir', async () => {
    const file = newFile([user('oi'), assistant([text('olá')])])
    expect(await textsOf(file)).toEqual(['oi', 'olá'])
    appendFileSync(file, jsonl([user('tudo bem?')]))
    expect(await textsOf(file)).toEqual(['oi', 'olá', 'tudo bem?'])
    expect(await textsOf(file)).toEqual(['oi', 'olá', 'tudo bem?'])
  })

  it('linha ainda sendo gravada entra quando termina, uma vez só', async () => {
    const file = newFile([user('oi')])
    const line = JSON.stringify(assistant([text('resposta')]))
    appendFileSync(file, line.slice(0, 30))
    expect(await textsOf(file)).toEqual(['oi'])
    appendFileSync(file, line.slice(30) + '\n')
    expect(await textsOf(file)).toEqual(['oi', 'resposta'])
  })

  it('última linha inteira sem "\\n" no fim também entra', async () => {
    const file = newFile([user('oi')])
    appendFileSync(file, JSON.stringify(user('sem quebra')))
    expect(await textsOf(file)).toEqual(['oi', 'sem quebra'])
  })

  it('arquivo regravado com outro conteúdo é lido do zero', async () => {
    const file = newFile([user('antiga 1'), user('antiga 2')])
    await textsOf(file)
    writeFileSync(file, jsonl([user('nova 1'), user('nova 2'), user('nova 3')]))
    expect(await textsOf(file)).toEqual(['nova 1', 'nova 2', 'nova 3'])
  })

  it('regravado com o mesmo tamanho, mas outra data, também', async () => {
    // A troca fica no começo da linha: o fim (que a leitura guarda de marca) continua igual.
    const { message, ...rest } = user('aaaa')
    const file = newFile([{ message, ...rest }])
    await textsOf(file)
    writeFileSync(file, jsonl([{ message: { role: 'user', content: 'bbbb' }, ...rest, uuid: (rest.uuid as string).replace(/.$/, 'f') }]))
    const later = new Date(Date.now() + 60_000)
    utimesSync(file, later, later)
    expect(await textsOf(file)).toEqual(['bbbb'])
  })

  it('arquivo que encolheu é lido do zero', async () => {
    const file = newFile([user('um'), user('dois'), user('três')])
    await textsOf(file)
    writeFileSync(file, jsonl([user('só')]))
    expect(await textsOf(file)).toEqual(['só'])
  })

  it('arquivo que não existe dá nulo', async () => {
    expect(await loadTranscript(join(process.env.HOME ?? '', 'nao-existe.jsonl'))).toBeNull()
  })

  // 4ab7c8a: rolar para cima carrega as anteriores até o começo, mesmo além das 400 na memória.
  it('a tela pedindo mensagens que já saíram da memória faz reler o arquivo inteiro', async () => {
    const file = newFile(Array.from({ length: 1000 }, (_, i) => user(`m${i}`)))
    const first = await loadTranscript(file)
    expect(first?.history.page({ count: 1000 }).more).toBe(true)
    const all = await loadTranscript(file, { count: 1000 })
    const page = all?.history.page({ count: 1000 })
    expect(page?.messages).toHaveLength(1000)
    expect(page?.more).toBe(false)
  })
})
