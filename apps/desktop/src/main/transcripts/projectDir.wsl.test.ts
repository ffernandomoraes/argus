import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// Pasta das conversas de um projeto com caminho comprido, no WSL. A procura pelo começo do nome vai
// pela pasta de rede: síncrona, travava o app inteiro enquanto o WSL respondia. Ela roda em segundo
// plano, e até achar vale o nome com o hash. Aqui a pasta "do WSL" é uma local (a procura é a mesma).

const root = vi.hoisted(() => ({ dir: '' }))
vi.mock('../claudeHome', () => ({ claudeDir: () => root.dir }))
vi.mock('../wsl', () => ({ distroFor: () => null, isWslPath: () => true, toLinux: (p: string) => p }))

import { projectDir } from './projectDir'

const flush = () => new Promise((r) => setTimeout(r, 50))

describe('projectDir no WSL, caminho comprido', () => {
  it('responde na hora com o nome com o hash; a procura acha a pasta certa para a próxima vez', async () => {
    root.dir = mkdtempSync(join(homedir(), 'wsl-claude-'))
    const long = join(homedir(), 'd'.repeat(120), 'e'.repeat(120))
    const prefix = long.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200)
    // O hash do fim mudou de versão: a pasta tem outro final, e o cwd gravado diz de quem é.
    const mine = join(root.dir, 'projects', `${prefix}-hashantigo`)
    mkdirSync(mine, { recursive: true })
    writeFileSync(join(mine, 'x.jsonl'), JSON.stringify({ type: 'user', cwd: long }) + '\n')

    const first = projectDir(long)
    expect(first).not.toBe(mine)
    expect(first.startsWith(join(root.dir, 'projects', prefix + '-'))).toBe(true)
    await flush()
    expect(projectDir(long)).toBe(mine)
  })
})
