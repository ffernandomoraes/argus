import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readOutputStyle, writeOutputStyle } from './outputStyle'

const project = () => mkdtempSync(join(homedir(), 'proj-'))

function settings(file: string, value: unknown): void {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}

describe('readOutputStyle', () => {
  it('vale o primeiro que tiver: local da pasta, projeto, usuário', () => {
    const dir = project()
    expect(readOutputStyle(dir)).toBe('default')
    settings(join(homedir(), '.claude', 'settings.json'), { outputStyle: 'Explanatory' })
    expect(readOutputStyle(dir)).toBe('Explanatory')
    settings(join(dir, '.claude', 'settings.json'), { outputStyle: 'Learning' })
    expect(readOutputStyle(dir)).toBe('Learning')
    settings(join(dir, '.claude', 'settings.local.json'), { outputStyle: 'Mine' })
    expect(readOutputStyle(dir)).toBe('Mine')
  })

  it('arquivo quebrado ou estilo vazio não derruba: passa para o seguinte', () => {
    const dir = project()
    mkdirSync(join(dir, '.claude'), { recursive: true })
    writeFileSync(join(dir, '.claude', 'settings.local.json'), '{ quebrado')
    settings(join(dir, '.claude', 'settings.json'), { outputStyle: '' })
    expect(readOutputStyle(dir)).not.toBe('')
  })
})

describe('writeOutputStyle', () => {
  it('grava no settings.local.json da pasta sem apagar o resto', () => {
    const dir = project()
    const file = join(dir, '.claude', 'settings.local.json')
    settings(file, { permissions: { allow: ['Bash(ls:*)'] } })
    writeOutputStyle(dir, 'Explanatory')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ permissions: { allow: ['Bash(ls:*)'] }, outputStyle: 'Explanatory' })
    expect(readOutputStyle(dir)).toBe('Explanatory')
  })

  it('cria a pasta .claude quando ainda não existe', () => {
    const dir = project()
    writeOutputStyle(dir, 'Learning')
    expect(readOutputStyle(dir)).toBe('Learning')
  })
})
