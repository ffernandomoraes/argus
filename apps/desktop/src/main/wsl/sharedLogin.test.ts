import { homedir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Um login só por conta no Windows e no WSL. Relatos de 2026-11-12 (Windows com o claude.exe e as
// pastas no WSL): a conversa do WSL usava um login guardado lá dentro, que era de outra conta do
// Claude ("selecionado na minha conta, gastando a de outro").

const fake = vi.hoisted(() => ({
  native: true,
  distro: null as string | null,
  winHome: '/mnt/c/Users/ana' as string | null | undefined,
  settings: {} as { wslSharedLogin?: boolean },
  files: new Map<string, unknown>(),
  written: [] as { path: string; data: unknown }[],
  probed: 0
}))

vi.mock('../platform', async (original) => ({ ...(await original<typeof import('../platform')>()), IS_WIN: true }))
vi.mock('../claudePath', () => ({ nativeClaudeFound: () => fake.native }))
vi.mock('../paths', () => ({ expandHome: (p: string) => p }))
vi.mock('./distros', () => ({
  claudeDistro: () => fake.distro,
  distroInfo: () => ({ home: '/home/ana', path: '', claude: '/usr/bin/claude', winHome: fake.winHome }),
  // A pergunta à distro: aqui, ela responde que os discos do Windows estão montados.
  loadDistro: async () => {
    fake.probed++
    fake.winHome = '/mnt/c/Users/ana'
    return null
  }
}))
vi.mock('./trash', () => ({}))
vi.mock('./log', () => ({ log: () => {} }))
vi.mock('./accounts', () => ({
  wslAccountDir: (info: { home: string }, id: string) => (id === 'main' ? undefined : `${info.home}/.argus/accounts/${id}`)
}))
vi.mock('../appSettings', () => ({ loadAppSettings: () => fake.settings }))
vi.mock('../accounts/paths', async () => {
  const os = await import('node:os')
  const path = await import('node:path')
  return { accountDir: (id: string) => (id === 'main' ? undefined : path.join(os.homedir(), '.argus', 'accounts', id)) }
})
vi.mock('../accounts/registry', () => ({ accountIds: () => ['main', 'ab12cd34'] }))
vi.mock('../lib/jsonFile', () => ({
  readJsonFileAsync: async (path: string) => (fake.files.has(path) ? { status: 'ok', data: fake.files.get(path) } : { status: 'missing' }),
  writeJsonAtomic: async (path: string, data: unknown) => {
    fake.written.push({ path, data })
  }
}))

import {
  alignWslIdentity,
  checkWindowsStore,
  setSharedLoginEnabled,
  sharedLoginBlocker,
  sharedLoginDir,
  sharedLoginHome,
  windowsHomeReady,
  sharesAppLogin
} from './sharedLogin'

const WSL = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\p'
const WINDOWS = 'C:\\Users\\ana\\p'
const INFO = { home: '/home/ana', path: '', claude: '/usr/bin/claude' }
const mainConfig = join(homedir(), '.claude.json')
const extraConfig = join(homedir(), '.argus', 'accounts', 'ab12cd34', '.claude.json')

// A resposta de "o claude.exe existe?" vale 5 s: cada teste anda o relógio para ela ser refeita.
let clock = Date.now()
beforeEach(async () => {
  clock += 60_000
  vi.setSystemTime(clock)
  fake.native = true
  fake.distro = null
  fake.winHome = '/mnt/c/Users/ana'
  fake.files.clear()
  fake.written = []
  setSharedLoginEnabled(true)
  await checkWindowsStore()
})

describe('sharedLoginDir', () => {
  it('com o claude.exe e os discos do Windows montados: a pasta da conta no Windows, vista de lá', () => {
    expect(sharedLoginDir('Ubuntu', 'main')).toBe('/mnt/c/Users/ana/.claude')
    expect(sharedLoginDir('Ubuntu', 'ab12cd34')).toBe('/mnt/c/Users/ana/.argus/accounts/ab12cd34')
    expect(sharedLoginBlocker('Ubuntu')).toBeNull()
  })

  it('discos do Windows fora da distro, ou distro que ainda não respondeu: login separado', () => {
    fake.winHome = null
    expect(sharedLoginDir('Ubuntu', 'main')).toBeNull()
    expect(sharedLoginBlocker('Ubuntu')).toBe('unmounted')
    fake.winHome = undefined
    expect(sharedLoginHome('Ubuntu')).toBeNull()
    expect(sharedLoginBlocker('Ubuntu')).toBe('unknown')
  })

  it('sem o claude.exe, o claude do app já roda na distro: nada a compartilhar', () => {
    fake.native = false
    fake.distro = 'Ubuntu'
    expect(sharedLoginDir('Ubuntu', 'main')).toBeNull()
    expect(sharedLoginBlocker('Ubuntu')).toBe('own')
  })

  it('distro conferida por uma versão anterior do app (sem a pasta do Windows): pergunta de novo antes de decidir', async () => {
    fake.winHome = undefined
    fake.probed = 0
    await windowsHomeReady('Ubuntu')
    expect(fake.probed).toBe(1)
    expect(sharedLoginDir('Ubuntu', 'main')).toBe('/mnt/c/Users/ana/.claude')
    await windowsHomeReady('Ubuntu')
    expect(fake.probed).toBe(1)
  })

  it('desligado nas configurações: login separado', () => {
    setSharedLoginEnabled(false)
    expect(sharedLoginDir('Ubuntu', 'main')).toBeNull()
    expect(sharedLoginBlocker('Ubuntu')).toBe('off')
  })

  it('Windows guardando o login no cofre de credenciais (não há arquivo para o Linux ler): login separado', async () => {
    fake.files.set(extraConfig, { cachedGrowthBookFeatures: { tengu_windows_credman: true } })
    await checkWindowsStore()
    expect(sharedLoginDir('Ubuntu', 'main')).toBeNull()
    expect(sharedLoginBlocker('Ubuntu')).toBe('vault')
  })
})

// Os limites que chegam nas conversas só valem para a barra de uso quando o login é o que ela lê.
describe('sharesAppLogin', () => {
  it('com o login compartilhado, a pasta do WSL usa o login do app', () => {
    expect(sharesAppLogin(WINDOWS)).toBe(true)
    expect(sharesAppLogin(WSL)).toBe(true)
  })

  it('com o login separado, a pasta do WSL não usa', () => {
    fake.winHome = null
    expect(sharesAppLogin(WINDOWS)).toBe(true)
    expect(sharesAppLogin(WSL)).toBe(false)
  })

  it('sem o claude.exe, tudo roda na distro do app: o login é o mesmo, menos em outra distro', () => {
    fake.native = false
    fake.distro = 'ubuntu'
    expect(sharesAppLogin(WINDOWS)).toBe(true)
    expect(sharesAppLogin(WSL)).toBe(true)
    expect(sharesAppLogin(WSL.replace('Ubuntu', 'Debian'))).toBe(false)
  })
})

// O .claude.json de lá ainda dizia de quem era o login separado de antes.
describe('alignWslIdentity', () => {
  const there = (linux: string) => `\\\\wsl.localhost\\Ubuntu${linux.replace(/\//g, '\\')}`

  it('e-mail de lá diferente do da conta no Windows: os dados do login anterior saem, o resto fica', async () => {
    fake.files.set(mainConfig, { oauthAccount: { emailAddress: 'ana@x.com' } })
    fake.files.set(there('/home/ana/.claude.json'), { oauthAccount: { emailAddress: 'bia@x.com' }, mcpServers: { a: 1 }, hasCompletedOnboarding: true })
    await alignWslIdentity('Ubuntu', INFO, 'main')
    expect(fake.written).toEqual([{ path: there('/home/ana/.claude.json'), data: { mcpServers: { a: 1 }, hasCompletedOnboarding: true } }])

    // Uma vez só por conta, distro e e-mail.
    await alignWslIdentity('Ubuntu', INFO, 'main')
    expect(fake.written).toHaveLength(1)
  })

  it('conta extra: o arquivo de lá é o da pasta dela', async () => {
    fake.files.set(extraConfig, { oauthAccount: { emailAddress: 'cris@x.com' } })
    fake.files.set(there('/home/ana/.argus/accounts/ab12cd34/.claude.json'), { oauthAccount: { emailAddress: 'bia@x.com' } })
    await alignWslIdentity('Ubuntu', INFO, 'ab12cd34')
    expect(fake.written).toEqual([{ path: there('/home/ana/.argus/accounts/ab12cd34/.claude.json'), data: {} }])
  })

  it('mesmo e-mail, arquivo de lá sem login, ou conta do Windows sem e-mail: nada é gravado', async () => {
    fake.files.set(mainConfig, { oauthAccount: { emailAddress: 'dani@x.com' } })
    fake.files.set(there('/home/ana/.claude.json'), { oauthAccount: { emailAddress: 'Dani@x.com' } })
    await alignWslIdentity('Ubuntu', INFO, 'main')
    fake.files.set(mainConfig, { oauthAccount: { emailAddress: 'edu@x.com' } })
    fake.files.set(there('/home/ana/.claude.json'), { mcpServers: {} })
    await alignWslIdentity('Ubuntu', INFO, 'main')
    fake.files.set(mainConfig, {})
    fake.files.set(there('/home/ana/.claude.json'), { oauthAccount: { emailAddress: 'bia@x.com' } })
    await alignWslIdentity('Ubuntu', INFO, 'main')
    expect(fake.written).toEqual([])
  })
})
