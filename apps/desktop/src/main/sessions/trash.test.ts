import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectDir } from '../transcripts/projectDir'
import { trashSession } from './trash'

// A Lixeira do sistema, observada: nada sai do disco de verdade.
const trashed = vi.hoisted(() => [] as string[])
vi.mock('electron', async (load) => ({
  ...(await load<object>()),
  shell: { trashItem: async (path: string) => void trashed.push(path) }
}))

// Pasta de projeto nova a cada teste: a Lixeira falsa não apaga nada.
let n = 0
const path = () => join(process.env.HOME ?? '', `proj${n}`)
const ID = '5e4479ab-a0be-4f15-8f49-a0c0e5f10ff4'

// Status que um Claude Code aberto grava (~/.claude/sessions/<pid>.json). O pid deste processo de
// teste está vivo, então vale como uma sessão aberta agora.
const statusDir = () => join(process.env.HOME ?? '', '.claude', 'sessions')
function openIn(status: 'busy' | 'waiting' | 'idle'): void {
  mkdirSync(statusDir(), { recursive: true })
  writeFileSync(join(statusDir(), `${process.pid}.json`), JSON.stringify({ pid: process.pid, sessionId: ID, status }))
}

beforeEach(() => {
  n++
  trashed.length = 0
  rmSync(statusDir(), { recursive: true, force: true })
  mkdirSync(projectDir(path()), { recursive: true })
  writeFileSync(join(projectDir(path()), `${ID}.jsonl`), '{}\n')
})

describe('trashSession', () => {
  it('manda o .jsonl e a pasta dos subagentes para a Lixeira', async () => {
    mkdirSync(join(projectDir(path()), ID))
    expect(await trashSession(path(), ID)).toBeNull()
    expect(trashed).toEqual([join(projectDir(path()), `${ID}.jsonl`), join(projectDir(path()), ID)])
  })

  it('sem pasta de subagentes, só o .jsonl', async () => {
    expect(await trashSession(path(), ID)).toBeNull()
    expect(trashed).toEqual([join(projectDir(path()), `${ID}.jsonl`)])
  })

  it('recusa id que sairia da pasta', async () => {
    expect(await trashSession(path(), '../../segredo')).toBe('Conversa inválida.')
    expect(trashed).toEqual([])
  })

  // O Claude Code regravaria o arquivo na hora.
  it('recusa conversa rodando ou esperando você', async () => {
    for (const status of ['busy', 'waiting'] as const) {
      openIn(status)
      expect(await trashSession(path(), ID)).toMatch(/em andamento/)
    }
    expect(trashed).toEqual([])
  })

  it('conversa aberta mas parada pode ir', async () => {
    openIn('idle')
    expect(await trashSession(path(), ID)).toBeNull()
  })
})
