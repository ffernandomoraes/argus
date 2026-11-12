import { afterAll, describe, expect, it, vi } from 'vitest'

// Onde roda o Claude Code de cada pasta, e se o login é o mesmo do `claude` do app.

const fake = vi.hoisted(() => ({ native: true, distro: null as string | null }))

vi.mock('../platform', async (original) => ({ ...(await original<typeof import('../platform')>()), IS_WIN: true }))
vi.mock('../claudePath', () => ({ nativeClaudeFound: () => fake.native }))
vi.mock('../paths', () => ({ expandHome: (p: string) => p }))
vi.mock('./distros', () => ({ claudeDistro: () => fake.distro }))
vi.mock('./trash', () => ({}))

import { sharesAppLogin } from './index'

// A resposta de "o claude.exe existe?" vale 5 s: cada teste anda o relógio para ela ser refeita.
afterAll(() => vi.useRealTimers())

const WSL = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\p'
const WINDOWS = 'C:\\Users\\ana\\p'

// 2026-11-12: os limites que chegam nas conversas só valem para a barra de uso quando o login é o
// que ela lê. O da pasta do WSL, com o claude.exe no Windows, é outro.
describe('sharesAppLogin', () => {
  it('com o claude.exe no Windows, a pasta do Windows usa o login do app e a do WSL não', async () => {
    fake.native = true
    vi.setSystemTime(Date.now() + 60_000)
    expect(sharesAppLogin(WINDOWS)).toBe(true)
    expect(sharesAppLogin(WSL)).toBe(false)
  })

  it('sem o claude.exe, tudo roda na distro do app: o login é o mesmo, menos em outra distro', () => {
    fake.native = false
    fake.distro = 'ubuntu'
    vi.setSystemTime(Date.now() + 120_000)
    expect(sharesAppLogin(WINDOWS)).toBe(true)
    expect(sharesAppLogin(WSL)).toBe(true)
    expect(sharesAppLogin(WSL.replace('Ubuntu', 'Debian'))).toBe(false)
  })
})
