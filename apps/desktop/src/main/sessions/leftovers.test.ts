import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { removeSessionLeftovers } from './leftovers'

// Excluir a conversa leva junto o que o Claude Code guardou dela fora do .jsonl. As pastas são de
// teste: nunca as de verdade do /tmp e do ~/.claude.

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

describe('removeSessionLeftovers', () => {
  it('apaga os rascunhos, os pontos de restauração e o ambiente do shell dela; os de outra conversa ficam', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'leftovers-temp-'))
    const config = mkdtempSync(join(tmpdir(), 'leftovers-config-'))
    const scratch = join(temp, '-Users-ana-proj', ID, 'scratchpad')
    const otherScratch = join(temp, '-Users-ana-proj', OTHER, 'scratchpad')
    for (const dir of [scratch, otherScratch, join(config, 'file-history', ID), join(config, 'session-env', ID), join(config, 'file-history', OTHER)]) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'x'), 'x')
    }
    await removeSessionLeftovers(ID, [temp], [config])
    expect(existsSync(join(temp, '-Users-ana-proj', ID))).toBe(false)
    expect(existsSync(join(config, 'file-history', ID))).toBe(false)
    expect(existsSync(join(config, 'session-env', ID))).toBe(false)
    expect(existsSync(otherScratch)).toBe(true)
    expect(existsSync(join(config, 'file-history', OTHER))).toBe(true)
  })

  it('id estranho (com ../) não apaga nada', async () => {
    const temp = mkdtempSync(join(tmpdir(), 'leftovers-temp-'))
    mkdirSync(join(temp, 'proj'), { recursive: true })
    await removeSessionLeftovers('../proj', [temp], [])
    expect(existsSync(join(temp, 'proj'))).toBe(true)
  })
})
