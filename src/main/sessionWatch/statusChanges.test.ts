import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LiveStatus } from '../../shared/history'
import { projectDir } from '../transcripts/projectDir'
import { changedSessions, projectsWith } from './statusChanges'

const map = (entries: [string, LiveStatus][]) => new Map(entries)

describe('changedSessions', () => {
  it('as que entraram, saíram ou trocaram de status', () => {
    const before = map([
      ['parada', 'idle'],
      ['rodando', 'running'],
      ['fechou', 'idle']
    ])
    const now = map([
      ['parada', 'idle'],
      ['rodando', 'needs-you'],
      ['abriu', 'running']
    ])
    expect(changedSessions(before, now).sort()).toEqual(['abriu', 'fechou', 'rodando'])
  })

  it('nada mudou, nada a avisar', () => {
    expect(changedSessions(map([['a', 'idle']]), map([['a', 'idle']]))).toEqual([])
  })
})

describe('projectsWith', () => {
  it('as pastas vigiadas que têm a conversa de algum dos ids', async () => {
    const home = process.env.HOME ?? ''
    const [a, b, c] = ['a', 'b', 'c'].map((name) => join(home, name))
    for (const path of [a, b]) mkdirSync(projectDir(path), { recursive: true })
    writeFileSync(join(projectDir(a), 'sessao-1.jsonl'), '{}\n')
    writeFileSync(join(projectDir(b), 'sessao-2.jsonl'), '{}\n')
    expect(await projectsWith(['sessao-1', 'sessao-3'], [a, b, c])).toEqual([a])
    expect(await projectsWith(['sessao-2', 'sessao-1'], [a, b, c])).toEqual([a, b])
    // Id que sairia da pasta é ignorado.
    expect(await projectsWith(['../a'], [a, b])).toEqual([])
  })
})
