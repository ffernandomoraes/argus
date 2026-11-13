import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assistant, text, user } from '../../../test/transcript'
import { projectDir } from '../transcripts/projectDir'
import { readSubagentPage } from '.'
import { subagentFile } from './subagentFile'

// O histórico de um subagente fica num arquivo ao lado da conversa, achado pelo .meta.json dele.
const SESSION = '5e4479ab-a0be-4f15-8f49-a0c0e5f10ff4'
let n = 0

function withSubagent(toolUseId: string, lines: object[]): string {
  const project = join(process.env.HOME ?? '', `proj${++n}`)
  const dir = join(projectDir(project), SESSION, 'subagents')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'Explore', toolUseId: 'outra' }))
  writeFileSync(join(dir, 'agent-a2.meta.json'), JSON.stringify({ agentType: 'Explore', toolUseId }))
  writeFileSync(join(dir, 'agent-a2.jsonl'), lines.map((l) => JSON.stringify(l) + '\n').join(''))
  return project
}

describe('subagentFile', () => {
  it('acha o arquivo pela chamada que lançou o subagente', async () => {
    const project = withSubagent('toolu_1', [])
    expect(await subagentFile(project, SESSION, 'toolu_1')).toMatch(/agent-a2\.jsonl$/)
    expect(await subagentFile(project, SESSION, 'toolu_9')).toBeNull()
  })

  it('id vindo da tela com "../" não sai da pasta', async () => {
    const project = withSubagent('toolu_1', [])
    expect(await subagentFile(project, '../x', 'toolu_1')).toBeNull()
    expect(await subagentFile(project, SESSION, '../toolu_1')).toBeNull()
  })
})

describe('readSubagentPage', () => {
  it('mostra o pedido e o que o subagente fez, marcados como dele', async () => {
    const project = withSubagent('toolu_2', [
      user('procura X', { isSidechain: true }),
      assistant([text('achei em a.ts')], {}, { isSidechain: true })
    ])
    const page = await readSubagentPage(project, SESSION, 'toolu_2', { count: 200 })
    expect(page.messages.map((m) => ('text' in m ? m.text : m.role))).toEqual(['procura X', 'achei em a.ts'])
  })

  it('subagente ainda sem arquivo: vazio', async () => {
    const project = withSubagent('toolu_3', [])
    expect(await readSubagentPage(project, SESSION, 'nenhum', { count: 200 })).toEqual({ messages: [], more: false })
  })
})
