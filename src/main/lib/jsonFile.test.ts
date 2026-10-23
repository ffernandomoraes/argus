import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeFileAtomic, writeFileAtomicSync } from './atomicWrite'
import { quarantine, readJsonFile, writeJsonAtomic, writeJsonAtomicSync } from './jsonFile'

// Base de todo arquivo do app (canvas, contas, configurações): ler sem confundir "não existe" com
// "estragado", e gravar sem nunca deixar o arquivo pela metade.

const folder = () => mkdtempSync(join(process.env.HOME ?? '', 'json-'))

describe('readJsonFile', () => {
  it('diferencia arquivo que não existe de arquivo estragado', () => {
    const dir = folder()
    writeFileSync(join(dir, 'bad.json'), '{"a": ')
    expect(readJsonFile(join(dir, 'none.json'))).toEqual({ status: 'missing' })
    expect(readJsonFile(join(dir, 'bad.json')).status).toBe('corrupt')
  })

  it('aceita o BOM do Bloco de Notas', () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.json'), '﻿{"a":1}')
    expect(readJsonFile(join(dir, 'a.json'))).toEqual({ status: 'ok', data: { a: 1 } })
  })

  it('pasta no lugar do arquivo conta como estragado, não como "não existe"', () => {
    const dir = folder()
    mkdirSync(join(dir, 'x.json'))
    expect(readJsonFile(join(dir, 'x.json')).status).toBe('corrupt')
  })
})

describe('quarantine', () => {
  it('move o arquivo estragado para um nome com a data, sem apagar nada', () => {
    const dir = folder()
    const path = join(dir, 'canvas.json')
    writeFileSync(path, 'lixo')
    const kept = quarantine(path)
    expect(kept).toMatch(/canvas\.corrompido-\d{8}-\d{6}\.json$/)
    expect(existsSync(path)).toBe(false)
    expect(readFileSync(kept!, 'utf8')).toBe('lixo')
  })

  it('duas vezes no mesmo segundo não sobrescreve a primeira', () => {
    const dir = folder()
    const path = join(dir, 'canvas.json')
    writeFileSync(path, 'um')
    const first = quarantine(path)
    writeFileSync(path, 'dois')
    const second = quarantine(path)
    expect(second).not.toBe(first)
    expect(readFileSync(first!, 'utf8')).toBe('um')
    expect(readFileSync(second!, 'utf8')).toBe('dois')
  })

  it('com copy, o original fica onde está', () => {
    const dir = folder()
    const path = join(dir, 'a.json')
    writeFileSync(path, 'x')
    expect(quarantine(path, { copy: true })).not.toBeNull()
    expect(readFileSync(path, 'utf8')).toBe('x')
  })
})

describe('gravação atômica', () => {
  it('cria a pasta que falta e não deixa temporário para trás', async () => {
    const dir = folder()
    const path = join(dir, 'novo', 'dados.json')
    await writeJsonAtomic(path, { a: 1 }, { indent: 2 })
    expect(readFileSync(path, 'utf8')).toBe('{\n  "a": 1\n}')
    writeJsonAtomicSync(join(dir, 'outro', 'b.json'), [1])
    expect(readdirSync(join(dir, 'novo'))).toEqual(['dados.json'])
    expect(readdirSync(join(dir, 'outro'))).toEqual(['b.json'])
  })

  it('o JSON é o do momento da chamada', async () => {
    const dir = folder()
    const data = { n: 1 }
    const done = writeJsonAtomic(join(dir, 'a.json'), data)
    data.n = 2
    await done
    expect(JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8'))).toEqual({ n: 1 })
  })

  it('valor sem JSON é recusado, sem apagar o arquivo de antes', async () => {
    const dir = folder()
    const path = join(dir, 'a.json')
    writeFileSync(path, '{"ok":true}')
    await expect(writeJsonAtomic(path, undefined)).rejects.toThrow()
    expect(() => writeJsonAtomicSync(path, undefined)).toThrow()
    expect(readFileSync(path, 'utf8')).toBe('{"ok":true}')
  })

  it('pedidos em fila: a última pedida vence, mesmo terminando fora de ordem', async () => {
    const dir = folder()
    const path = join(dir, 'a.txt')
    const writes = ['1', '2', '3', '4'].map((t) => writeFileAtomic(path, t))
    await Promise.all(writes)
    expect(readFileSync(path, 'utf8')).toBe('4')
    expect(readdirSync(dir)).toEqual(['a.txt'])
  })

  it('a síncrona da saída do app vale mais que as assíncronas pendentes', async () => {
    const dir = folder()
    const path = join(dir, 'a.txt')
    const older = writeFileAtomic(path, 'velho')
    writeFileAtomicSync(path, 'saida')
    const newer = writeFileAtomic(path, 'depois')
    await Promise.all([older, newer])
    expect(readFileSync(path, 'utf8')).toBe('depois')

    const stale = writeFileAtomic(path, 'velho de novo')
    writeFileAtomicSync(path, 'final')
    await stale
    expect(readFileSync(path, 'utf8')).toBe('final')
  })

  // O caso do fechamento do app: a assíncrona já está escrevendo o temporário quando a síncrona
  // grava. Ao terminar, ela não pode trocar o arquivo pelo conteúdo velho.
  it('assíncrona no meio da gravação não desfaz a síncrona', async () => {
    const dir = folder()
    const path = join(dir, 'a.txt')
    const older = writeFileAtomic(path, 'x'.repeat(5_000_000))
    const until = Date.now() + 5000
    while (!readdirSync(dir).some((name) => name.endsWith('.tmp'))) {
      if (Date.now() > until) throw new Error('a gravação assíncrona não começou')
      await new Promise((r) => setImmediate(r))
    }
    writeFileAtomicSync(path, 'saida')
    await older
    expect(readFileSync(path, 'utf8')).toBe('saida')
    expect(readdirSync(dir)).toEqual(['a.txt'])
  })

  // Credenciais (contas) gravam com 0o600: só a pessoa lê. O Windows não tem esses bits.
  it.skipIf(process.platform === 'win32')('grava com as permissões pedidas', async () => {
    const dir = folder()
    await writeFileAtomic(join(dir, 'secret'), 'x', { mode: 0o600 })
    writeFileAtomicSync(join(dir, 'shared'), 'x', { mode: 0o664 })
    expect(statSync(join(dir, 'secret')).mode & 0o777).toBe(0o600)
    expect(statSync(join(dir, 'shared')).mode & 0o777).toBe(0o664)
  })
})
