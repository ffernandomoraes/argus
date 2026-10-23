import { appendFileSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aiTitle, assistant, customTitle, text, user } from '../../../test/transcript'
import { projectDir } from '../transcripts/projectDir'
import { listSessions } from './list'

// A lista de conversas de uma pasta, lida de ~/.claude/projects (na pasta pessoal falsa).

let n = 0
// Pasta de projeto nova a cada teste (o cache da lista é por pasta).
function project(): string {
  const path = join(process.env.HOME ?? '', `proj${++n}`)
  mkdirSync(projectDir(path), { recursive: true })
  return path
}

function writeSession(path: string, id: string, lines: object[]): string {
  const file = join(projectDir(path), `${id}.jsonl`)
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  return file
}

const byId = (list: Awaited<ReturnType<typeof listSessions>>) => Object.fromEntries(list.map((s) => [s.id, s]))

describe('listSessions', () => {
  it('lista cada conversa com título, horário e contexto; sessão vazia e outros arquivos ficam de fora', async () => {
    const path = project()
    writeSession(path, 'com-titulo', [user('oi'), aiTitle('Login quebrado'), assistant([text('vejo')], { usage: { input_tokens: 10_000, output_tokens: 1 } })])
    writeSession(path, 'so-pedido', [user('arruma o build')])
    writeSession(path, 'vazia', [{ type: 'queue-operation', operation: 'enqueue' }])
    writeFileSync(join(projectDir(path), 'vazia2.jsonl'), '')
    writeFileSync(join(projectDir(path), 'notas.txt'), 'x')

    const list = byId(await listSessions(path))
    expect(Object.keys(list).sort()).toEqual(['com-titulo', 'so-pedido'])
    expect(list['com-titulo']).toMatchObject({ title: 'Login quebrado', contextPercent: 1, live: null })
    expect(list['so-pedido'].title).toBe('arruma o build')
  })

  it('conversa só com print aparece como "Conversa sem título"', async () => {
    const path = project()
    writeSession(path, 'print', [user([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aGk=' } }])])
    expect((await listSessions(path))[0].title).toBe('Conversa sem título')
  })

  it('pasta sem conversas: lista vazia, sem erro', async () => {
    expect(await listSessions(join(process.env.HOME ?? '', 'nunca-usada'))).toEqual([])
  })

  // A lista guarda o que já leu: arquivo que mudou é relido, e o apagado sai.
  it('acompanha arquivo que cresceu e arquivo apagado', async () => {
    const path = project()
    const file = writeSession(path, 'a', [user('primeiro')])
    writeSession(path, 'b', [user('outra')])
    expect((await listSessions(path)).length).toBe(2)

    appendFileSync(file, JSON.stringify(customTitle('Renomeada')) + '\n')
    // Mesma data com tamanho diferente também conta como mudança.
    const later = new Date(Date.now() + 5000)
    utimesSync(file, later, later)
    rmSync(join(projectDir(path), 'b.jsonl'))

    const list = await listSessions(path)
    expect(list.map((s) => [s.id, s.title])).toEqual([['a', 'Renomeada']])
  })
})
