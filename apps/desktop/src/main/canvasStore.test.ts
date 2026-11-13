import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// O canvas.json guarda tudo o que a pessoa montou (grupos, pastas, posições). Nenhum caminho aqui
// pode trocar o canvas dela por um vazio.

const dir = () => app.getPath('userData')
const file = () => join(dir(), 'canvas.json')
const backup = () => file() + '.bak'
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const quarantined = () => readdirSync(dir()).filter((name) => name.startsWith('canvas.corrompido-'))

const GROUP = { id: 'g-1', type: 'area', position: { x: 0, y: 0 }, data: { label: 'Trabalho', color: '#71717a' } }
const FOLDER = { id: 'p-1', type: 'project', position: { x: 10, y: 10 }, data: { name: 'proj', path: '~/proj', color: '#fff' } }

// O módulo lembra o canvas lido na abertura (para a cópia de segurança): cada teste é uma abertura.
const open = async () => {
  vi.resetModules()
  return import('./canvasStore')
}

beforeEach(() => {
  rmSync(dir(), { recursive: true, force: true })
  mkdirSync(dir(), { recursive: true })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('loadCanvas', () => {
  it('sem arquivo, canvas novo e liberado para gravar', async () => {
    const { loadCanvas } = await open()
    expect(loadCanvas()).toEqual({ nodes: null, usable: true })
  })

  it('lê o canvas salvo, mesmo gravado com BOM pelo Bloco de Notas do Windows', async () => {
    writeFileSync(file(), '﻿' + JSON.stringify([GROUP, FOLDER]))
    const { loadCanvas } = await open()
    expect(loadCanvas()).toEqual({ nodes: [GROUP, FOLDER], usable: true })
  })

  it('arquivo estragado sem cópia: guarda o original ao lado e não deixa gravar por cima', async () => {
    writeFileSync(file(), '[{"id": "g-1", "type": ')
    const { loadCanvas } = await open()
    expect(loadCanvas()).toEqual({ nodes: null, usable: false })
    const kept = quarantined()
    expect(kept).toHaveLength(1)
    expect(readFileSync(join(dir(), kept[0]), 'utf8')).toBe('[{"id": "g-1", "type": ')
  })

  it('formato desconhecido (não é lista) também vai para o lado, sem virar canvas vazio', async () => {
    writeFileSync(file(), JSON.stringify({ nodes: [GROUP] }))
    const { loadCanvas } = await open()
    expect(loadCanvas().usable).toBe(false)
    expect(quarantined()).toHaveLength(1)
  })

  it('arquivo estragado com cópia: volta a cópia e põe no lugar do original', async () => {
    writeFileSync(file(), 'lixo')
    writeFileSync(backup(), JSON.stringify([GROUP]))
    const { loadCanvas } = await open()
    expect(loadCanvas()).toEqual({ nodes: [GROUP], usable: true })
    expect(read(file())).toEqual([GROUP])
    expect(quarantined()).toHaveLength(1)
  })
})

describe('cópia de segurança', () => {
  it('a primeira gravação da abertura guarda o canvas que abriu bem', async () => {
    writeFileSync(file(), JSON.stringify([GROUP, FOLDER]))
    const { loadCanvas, saveCanvasNow } = await open()
    loadCanvas()
    saveCanvasNow([GROUP])
    expect(read(backup())).toEqual([GROUP, FOLDER])
    expect(read(file())).toEqual([GROUP])
  })

  it('as gravações seguintes não trocam a cópia pelo estado do meio', async () => {
    writeFileSync(file(), JSON.stringify([GROUP, FOLDER]))
    const { loadCanvas, saveCanvas, saveCanvasNow } = await open()
    loadCanvas()
    await saveCanvas([GROUP])
    saveCanvasNow([])
    expect(read(backup())).toEqual([GROUP, FOLDER])
    expect(read(file())).toEqual([])
  })

  it('canvas que não abriu bem não vira cópia', async () => {
    writeFileSync(file(), 'lixo')
    const { loadCanvas, saveCanvasNow } = await open()
    loadCanvas()
    saveCanvasNow([FOLDER])
    expect(existsSync(backup())).toBe(false)
    expect(read(file())).toEqual([FOLDER])
  })
})

describe('saveCanvas', () => {
  it('várias gravações seguidas: fica a última pedida', async () => {
    const { saveCanvas } = await open()
    await Promise.all([saveCanvas([GROUP]), saveCanvas([FOLDER]), saveCanvas([GROUP, FOLDER])])
    expect(read(file())).toEqual([GROUP, FOLDER])
  })

  it('a gravação da saída do app vence uma assíncrona que ainda não terminou', async () => {
    const { saveCanvas, saveCanvasNow } = await open()
    const pending = saveCanvas([GROUP])
    saveCanvasNow([FOLDER])
    await pending
    expect(read(file())).toEqual([FOLDER])
  })
})

describe('readSavedNodes', () => {
  it('só consulta: arquivo estragado dá lista vazia e fica onde está', async () => {
    writeFileSync(file(), 'lixo')
    const { readSavedNodes } = await open()
    expect(readSavedNodes()).toEqual([])
    expect(readFileSync(file(), 'utf8')).toBe('lixo')
  })
})
