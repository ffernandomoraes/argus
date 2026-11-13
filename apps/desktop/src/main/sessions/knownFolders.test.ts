import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listKnownFolders } from './knownFolders'

// A lista do "Nova pasta": de onde o Claude Code já conversou. As pastas de teste ficam dentro da
// temporária do sistema, que a lista ignora de propósito; por isso as pastas "de projeto" aqui são
// a deste repositório e a de cima dele (só lidas, nunca gravadas).
const REPO = process.cwd()
const PARENT = dirname(REPO)

const flat = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-')
const projects = () => join(process.env.HOME ?? '', '.claude', 'projects')

let age = 0
// Uma conversa feita em `cwds` (o primeiro é onde ela abriu), gravada na pasta de `dirFor`.
function conversation(dirFor: string, cwds: string[]): void {
  const dir = join(projects(), flat(dirFor))
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `s${++age}.jsonl`)
  writeFileSync(file, cwds.map((cwd) => JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'oi' } })).join('\n') + '\n')
  const at = new Date(Date.parse('2026-10-01T00:00:00Z') + age * 60_000)
  utimesSync(file, at, at)
}

describe('listKnownFolders', () => {
  it('lista as pastas da mais recente para a mais antiga e deixa de fora pessoal, temporária e apagada', async () => {
    conversation(PARENT, [PARENT])
    // `cd` no meio: o cwd que vale é o que, achatado, dá o nome da pasta.
    conversation(REPO, [join(REPO, 'src'), REPO])
    conversation(process.env.HOME ?? '', [process.env.HOME ?? ''])
    conversation(join(process.env.HOME ?? '', 'rascunho'), [join(process.env.HOME ?? '', 'rascunho')])
    conversation('/nao/existe/mais', ['/nao/existe/mais'])
    // Sessão aberta e fechada: arquivo vazio não conta.
    mkdirSync(join(projects(), 'vazia'))
    writeFileSync(join(projects(), 'vazia', 'x.jsonl'), '')

    const folders = await listKnownFolders()
    expect(folders.map((f) => f.path)).toEqual([REPO, PARENT])
    expect(folders[0].updatedAt).toBe(new Date(Date.parse('2026-10-01T00:00:00Z') + 2 * 60_000).toISOString())
  })
})
