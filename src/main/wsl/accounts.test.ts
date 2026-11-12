import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { linkScript } from './accounts'

// A pasta de uma conta extra no Linux liga o que é compartilhado à principal, rodado de verdade num
// `sh` (fora do Windows).

const root = mkdtempSync(join(tmpdir(), 'argus-account-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe.skipIf(process.platform === 'win32')('linkScript', () => {
  it('liga à principal o que falta e troca pasta vazia pelo link; pasta com coisas fica', () => {
    const main = join(root, '.claude')
    const dir = join(root, '.argus', 'accounts', 'ab12cd34')
    mkdirSync(join(main, 'skills'), { recursive: true })
    mkdirSync(join(main, 'agents'))
    writeFileSync(join(main, 'CLAUDE.md'), 'instruções\n')
    // A conta tem uma pasta de skills vazia (de antes de a principal ganhar as do Windows) e a sua de agents.
    mkdirSync(join(dir, 'skills'), { recursive: true })
    mkdirSync(join(dir, 'agents'))
    writeFileSync(join(dir, 'agents', 'meu.md'), 'da conta\n')

    execFileSync('sh', ['-s'], { input: linkScript(dir, main), encoding: 'utf8', timeout: 20_000 })
    expect(readlinkSync(join(dir, 'skills'))).toBe(join(main, 'skills'))
    expect(readlinkSync(join(dir, 'CLAUDE.md'))).toBe(join(main, 'CLAUDE.md'))
    expect(readlinkSync(join(dir, 'projects'))).toBe(join(main, 'projects'))
    expect(lstatSync(join(dir, 'agents')).isSymbolicLink()).toBe(false)
    expect(lstatSync(join(dir, 'sessions')).isDirectory()).toBe(true)
  })
})
