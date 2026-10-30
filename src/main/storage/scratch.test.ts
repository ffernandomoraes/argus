import { mkdirSync, mkdtempSync, existsSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanScratch, scratchUsage } from './scratch'

// Os rascunhos do agente: a pasta temporária de cada conversa. Errar aqui é apagar o que uma conversa
// rodando está usando, ou deixar os gigas de uma parada para sempre. As pastas são de teste: nunca
// as de verdade do /tmp.

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 30)
const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

function session(root: string, id: string, ageDays: number): string {
  const dir = join(root, '-Users-ana-proj', id)
  mkdirSync(join(dir, 'scratchpad', 'repo'), { recursive: true })
  writeFileSync(join(dir, 'scratchpad', 'repo', 'big.bin'), Buffer.alloc(64 * 1024))
  const at = new Date(NOW - ageDays * DAY)
  for (const p of [join(dir, 'scratchpad', 'repo', 'big.bin'), join(dir, 'scratchpad', 'repo'), join(dir, 'scratchpad'), dir]) utimesSync(p, at, at)
  return dir
}

describe('cleanScratch', () => {
  it('apaga a pasta da conversa parada há mais que o prazo; a recente e a rodando ficam', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scratch-'))
    const old = session(root, A, 10)
    const recent = session(root, B, 1)
    const running = session(root, C, 10)
    // Outras coisas da pasta temporária (não são de conversa) não são tocadas.
    mkdirSync(join(root, 'bash-edit-diff'))
    const result = await cleanScratch(3, new Set([C]), NOW, [root])
    expect(result.removed).toBe(1)
    expect(result.freedBytes).toBeGreaterThan(0)
    expect([existsSync(old), existsSync(recent), existsSync(running), existsSync(join(root, 'bash-edit-diff'))]).toEqual([false, true, true, true])
  })

  it('mexida há pouco lá dentro (um arquivo novo no scratchpad) conta como recente', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scratch-'))
    const dir = session(root, A, 10)
    const recent = new Date(NOW - DAY)
    utimesSync(join(dir, 'scratchpad', 'repo'), recent, recent)
    expect((await cleanScratch(3, new Set(), NOW, [root])).removed).toBe(0)
  })

  it('mede o tamanho e quantas conversas têm rascunho', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scratch-'))
    session(root, A, 1)
    session(root, B, 1)
    const usage = await scratchUsage([root])
    expect(usage.sessions).toBe(2)
    expect(usage.bytes).toBeGreaterThanOrEqual(2 * 64 * 1024)
  })
})
