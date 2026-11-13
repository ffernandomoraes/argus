import { describe, expect, it, vi } from 'vitest'

// Relato de 2026-11-11 (Windows com o claude.exe e projeto no WSL): a conta aparecia conectada e a
// conversa da pasta do WSL respondia "Not logged in". O login de lá é outro, e o app não olhava.

const fake = vi.hoisted(() => ({
  own: null as string | null,
  withClaude: ['Ubuntu', 'Debian'],
  existing: new Set<string>(),
  asked: [] as { id: string; place?: string }[],
  // Distros em que o claude usa o próprio login do Windows (ver wsl/sharedLogin.ts).
  shared: new Set<string>()
}))

vi.mock('../claudeHome', () => ({ claudeDistros: () => fake.withClaude }))
vi.mock('../wsl', () => ({
  distroFor: () => fake.own,
  distroInfo: (d: string) => (d === 'Sumiu' ? null : { home: '/home/ana', claude: '/usr/bin/claude', path: '' }),
  homeUnc: (d: string) => `\\\\wsl.localhost\\${d}\\home\\ana`,
  knownDistros: () => fake.withClaude,
  sameDistro: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
  toUnc: (d: string, linux: string) => `\\\\wsl.localhost\\${d}${linux.replace(/\//g, '\\')}`
}))
vi.mock('../wsl/sharedLogin', () => ({ sharedLoginHome: (d: string) => (fake.shared.has(d.toLowerCase()) ? '/mnt/c/Users/ana' : null) }))
vi.mock('../wsl/accounts', () => ({
  wslAccountDir: (_info: unknown, id: string) => (id === 'main' ? undefined : `/home/ana/.argus/accounts/${id}`)
}))
vi.mock('node:fs/promises', () => ({
  access: (path: string) => (fake.existing.has(path) ? Promise.resolve() : Promise.reject(Object.assign(new Error('não existe'), { code: 'ENOENT' })))
}))
vi.mock('./status', () => ({
  readAccount: (id: string, place?: string) => {
    fake.asked.push({ id, place })
    return Promise.resolve({ ok: true, account: { loggedIn: true, email: 'ana@x.com' } })
  }
}))

import { loginDistro, otherDistros, readWslAccount } from './wslPlace'

describe('otherDistros', () => {
  it('com o claude do app no Windows, todas as distros com o Claude têm login próprio', () => {
    fake.own = null
    expect(otherDistros()).toEqual(['Ubuntu', 'Debian'])
  })

  it('com o claude do app numa distro, ela fica de fora: o login dela é o comum', () => {
    fake.own = 'ubuntu'
    expect(otherDistros()).toEqual(['Debian'])
  })

  // 2026-11-12: com o login do Windows valendo dentro da distro, ela não tem login à parte.
  it('distro que usa o login do Windows fica de fora, e entrar nela é entrar na conta', () => {
    fake.own = null
    fake.shared.add('ubuntu')
    expect(otherDistros()).toEqual(['Debian'])
    expect(loginDistro('Ubuntu')).toBeUndefined()
    expect(loginDistro('Debian')).toBe('Debian')
    fake.shared.clear()
  })
})

describe('loginDistro', () => {
  it('a distro do próprio claude do app vira o login comum', () => {
    fake.own = 'Ubuntu'
    expect(loginDistro('ubuntu')).toBeUndefined()
    expect(loginDistro(undefined)).toBeUndefined()
  })

  it('outra distro segue, com o nome como o WSL escreve', () => {
    fake.own = null
    expect(loginDistro('ubuntu')).toBe('Ubuntu')
    expect(loginDistro('Arch')).toBe('Arch')
  })
})

describe('readWslAccount', () => {
  it('pergunta ao claude da distro, na pasta do usuário de lá', async () => {
    fake.asked = []
    expect(await readWslAccount('Ubuntu', 'main')).toEqual({ ok: true, account: { loggedIn: true, email: 'ana@x.com' } })
    expect(fake.asked).toEqual([{ id: 'main', place: '\\\\wsl.localhost\\Ubuntu\\home\\ana' }])
  })

  it('conta extra sem pasta na distro está sem login, e a pasta não é criada só para perguntar', async () => {
    fake.asked = []
    fake.existing.clear()
    expect(await readWslAccount('Ubuntu', 'ab12cd34')).toEqual({ ok: true, account: { loggedIn: false } })
    expect(fake.asked).toEqual([])
  })

  it('conta extra com pasta na distro é conferida', async () => {
    fake.asked = []
    fake.existing.add('\\\\wsl.localhost\\Ubuntu\\home\\ana\\.argus\\accounts\\ab12cd34')
    expect((await readWslAccount('Ubuntu', 'ab12cd34')).ok).toBe(true)
    expect(fake.asked).toHaveLength(1)
  })

  it('distro que o app ainda não conhece: sem resposta, mantém o que se sabia', async () => {
    expect(await readWslAccount('Sumiu', 'main')).toEqual({ ok: false })
  })
})
