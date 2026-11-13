import { appendFileSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiTitle, assistant, customTitle, text, user } from '../../../test/transcript'
import { projectDir } from '../transcripts/projectDir'
import { listSessions } from './list'

// A lista de conversas de uma pasta, lida de ~/.claude/projects (na pasta pessoal falsa).

// Pastas que não respondem, como a do WSL com a máquina virtual travada; o resto lê o disco.
const fs = vi.hoisted(() => ({ silent: new Set<string>(), reads: [] as string[] }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>()
  const readdir = (path: string, ...rest: unknown[]) => {
    fs.reads.push(String(path))
    return fs.silent.has(String(path)) ? new Promise(() => {}) : (real.readdir as (...args: unknown[]) => Promise<unknown>)(path, ...rest)
  }
  return { ...real, readdir }
})

afterEach(() => {
  vi.useRealTimers()
})

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

const byId = (list: Awaited<ReturnType<typeof listSessions>>) => Object.fromEntries((list ?? []).map((s) => [s.id, s]))

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
    expect((await listSessions(path))?.[0].title).toBe('Conversa sem título')
  })

  it('pasta sem conversas: lista vazia, sem erro', async () => {
    expect(await listSessions(join(process.env.HOME ?? '', 'nunca-usada'))).toEqual([])
  })

  // 2026-10-23: com o WSL travado, a leitura falhava, virava lista vazia, e o card mostrava
  // "Nenhuma conversa ainda" até o WSL voltar. Não ler não é o mesmo que não ter conversa.
  describe('pasta que não deu para ler', () => {
    it('erro ao ler a pasta de conversas: nulo, não lista vazia', async () => {
      const path = join(process.env.HOME ?? '', 'sem-permissao')
      // No lugar da pasta, um arquivo: a leitura falha sem ser "pasta não existe".
      mkdirSync(dirname(projectDir(path)), { recursive: true })
      writeFileSync(projectDir(path), 'x')
      expect(await listSessions(path)).toBeNull()
    })

    it('sem a pasta do usuário de quem roda o Claude (a do Linux, com o WSL parado): nulo', async () => {
      const home = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }
      const gone = join(home.HOME ?? '', 'wsl-parado')
      process.env.HOME = process.env.USERPROFILE = gone
      try {
        expect(await listSessions(join(gone, 'proj'))).toBeNull()
      } finally {
        Object.assign(process.env, home)
      }
    })

    it('pasta que não responde: nulo no prazo, e quem pergunta de novo espera a mesma leitura', async () => {
      const path = project()
      writeSession(path, 'a', [user('oi')])
      fs.silent.add(projectDir(path))
      vi.useFakeTimers()
      const first = listSessions(path)
      await vi.advanceTimersByTimeAsync(8000)
      expect(await first).toBeNull()
      const second = listSessions(path)
      await vi.advanceTimersByTimeAsync(8000)
      expect(await second).toBeNull()
      expect(fs.reads.filter((p) => p === projectDir(path))).toHaveLength(1)
    })
  })

  // A lista guarda o que já leu: arquivo que mudou é relido, e o apagado sai.
  it('acompanha arquivo que cresceu e arquivo apagado', async () => {
    const path = project()
    const file = writeSession(path, 'a', [user('primeiro')])
    writeSession(path, 'b', [user('outra')])
    expect((await listSessions(path))?.length).toBe(2)

    appendFileSync(file, JSON.stringify(customTitle('Renomeada')) + '\n')
    // Mesma data com tamanho diferente também conta como mudança.
    const later = new Date(Date.now() + 5000)
    utimesSync(file, later, later)
    rmSync(join(projectDir(path), 'b.jsonl'))

    const list = await listSessions(path)
    expect(list?.map((s) => [s.id, s.title])).toEqual([['a', 'Renomeada']])
  })
})
