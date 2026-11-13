import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dirHoldsCwd, isSessionId, projectDir, sessionFile } from './projectDir'

// O nome da pasta tem que bater com o que o Claude Code grava; errar aqui some com todas as conversas
// da pasta na lista.

const IS_WIN = process.platform === 'win32'
const projects = () => join(process.env.HOME ?? '', '.claude', 'projects')

describe('projectDir', () => {
  it.skipIf(IS_WIN)('achata o caminho: tudo que não é letra ou número vira "-"', () => {
    expect(projectDir('/Users/ana/meu projeto.v2')).toBe(join(projects(), '-Users-ana-meu-projeto-v2'))
    expect(projectDir('/Users/ana/gestão')).toBe(join(projects(), '-Users-ana-gest-o'))
  })

  it.skipIf(IS_WIN)('sem barra no fim nem "..", como o cwd do processo', () => {
    expect(projectDir('/Users/ana/proj/')).toBe(projectDir('/Users/ana/proj'))
    expect(projectDir('/Users/ana/x/../proj')).toBe(projectDir('/Users/ana/proj'))
  })

  it.skipIf(IS_WIN)('entende "~" como a pasta pessoal', () => {
    expect(projectDir('~/proj')).toBe(projectDir(join(process.env.HOME ?? '', 'proj')))
  })

  // O macOS pode entregar o acento decomposto (NFD); o Claude Code normaliza antes de achatar.
  it.skipIf(process.platform !== 'darwin')('no Mac, o acento decomposto dá a mesma pasta', () => {
    expect(projectDir('/Users/ana/A\u0301rea')).toBe(projectDir('/Users/ana/\u00c1rea'))
  })

  it.skipIf(!IS_WIN)('no Windows, a letra do disco e as barras viram "-"', () => {
    expect(projectDir('C:\\Users\\ana\\proj')).toBe(join(projects(), 'C--Users-ana-proj'))
  })

  // Caminho com mais de 200 caracteres (comum com o OneDrive): o nome leva um hash que pode mudar
  // entre versões do Claude Code; vale a pasta com o mesmo começo que tem conversa feita ali.
  it('caminho comprido: acha a pasta pelo começo do nome e pelo cwd gravado', () => {
    const long = join(process.env.HOME ?? '', 'a'.repeat(120), 'b'.repeat(120))
    const prefix = long.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200)
    const other = join(projects(), `${prefix}-aaaoutro`)
    const mine = join(projects(), `${prefix}-zzzantigo`)
    mkdirSync(other, { recursive: true })
    mkdirSync(mine, { recursive: true })
    writeFileSync(join(other, 'x.jsonl'), JSON.stringify({ type: 'user', cwd: `${long}-outro` }) + '\n')
    writeFileSync(join(mine, 'y.jsonl'), JSON.stringify({ type: 'user', cwd: long }) + '\n')
    expect(projectDir(long)).toBe(mine)
  })

  it('caminho comprido sem pasta ainda: o nome com o hash', () => {
    const long = join(process.env.HOME ?? '', 'c'.repeat(250))
    const name = projectDir(long).slice(projects().length + 1)
    expect(name.length).toBeGreaterThan(201)
    expect(name.slice(0, 200)).toBe(long.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200))
  })
})

describe('isSessionId e sessionFile', () => {
  it('recusa id que sai da pasta', () => {
    expect(isSessionId('5e4479ab-a0be-4f15-8f49-a0c0e5f10ff4')).toBe(true)
    expect(isSessionId('../../etc/passwd')).toBe(false)
    expect(isSessionId('a/b')).toBe(false)
    expect(isSessionId('a\\b')).toBe(false)
    expect(isSessionId('')).toBe(false)
    expect(isSessionId(42)).toBe(false)
    expect(sessionFile('/Users/ana/proj', '../x')).toBeNull()
  })

  it('o arquivo é <id>.jsonl na pasta do projeto', () => {
    const path = join(process.env.HOME ?? '', 'proj')
    expect(sessionFile(path, 'abc')).toBe(join(projectDir(path), 'abc.jsonl'))
  })
})

describe('dirHoldsCwd', () => {
  it('a pasta é a do cwd só se o nome achatado bater inteiro', () => {
    expect(dirHoldsCwd('-Users-ana-proj', '/Users/ana/proj')).toBe(true)
    // `cd` no meio da conversa: o cwd gravado é de outra pasta.
    expect(dirHoldsCwd('-Users-ana-proj', '/Users/ana/proj/src')).toBe(false)
    expect(dirHoldsCwd('-Users-ana-proj-src', '/Users/ana/proj')).toBe(false)
  })

  it('nome comprido: basta o começo, o hash do fim pode ter mudado', () => {
    const cwd = '/x/' + 'd'.repeat(300)
    const prefix = cwd.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200)
    expect(dirHoldsCwd(`${prefix}-qualquerhash`, cwd)).toBe(true)
    expect(dirHoldsCwd(`${prefix.slice(0, -1)}e-hash`, cwd)).toBe(false)
  })

  it.skipIf(!IS_WIN)('no Windows, sem diferenciar maiúsculas', () => {
    expect(dirHoldsCwd('c--users-ana-proj', 'C:\\Users\\ana\\proj')).toBe(true)
  })
})
