import { beforeEach, describe, expect, it, vi } from 'vitest'

// O ambiente do `claude` que roda dentro da distro: a pasta da conta e o lugar do login.

const fake = vi.hoisted(() => ({ shared: true, aligned: [] as string[], winEnv: {} as Record<string, string> }))

// A regra de verdade das variáveis que trocam o login (sem o resto das contas, que pede o Electron).
vi.mock('../accounts', async () => ({
  ...(await import('../accounts/loginOverrides')),
  resolveAccount: (id?: string) => id || 'main'
}))
vi.mock('../i18n', () => ({ tr: (pt: string) => pt }))
// O ambiente do Windows em que o app abriu.
vi.mock('../platform', () => ({ childEnv: () => ({ ...fake.winEnv }) }))
vi.mock('./accounts', () => ({
  prepareWslAccount: async () => {},
  wslAccountDir: (info: { home: string }, id: string) => (id === 'main' ? undefined : `${info.home}/.argus/accounts/${id}`)
}))
vi.mock('./distros', () => ({ ensureDistro: async () => ({ home: '/home/ana', path: '', claude: '/usr/bin/claude' }), WSL_EXE: 'wsl.exe' }))
vi.mock('./install', () => ({ installInWsl: async () => null, watchInstall: () => {}, WSL_INSTALL: '' }))
vi.mock('./log', () => ({ log: () => {} }))
vi.mock('./path', () => ({ toLinux: (p: string) => p }))
vi.mock('./run', () => ({
  // O processo de verdade abre depois; aqui o teste chama a montagem direto.
  deferredWslProcess: (_distro: string, build: unknown) => build,
  linuxEnv: (env: Record<string, string>) => ({ ...env }),
  wslCommand: async () => ({ file: 'wsl.exe', args: [] })
}))
vi.mock('./sharedLogin', () => ({
  sharedLoginDir: (_distro: string, account: string) =>
    fake.shared ? (account === 'main' ? '/mnt/c/Users/ana/.claude' : `/mnt/c/Users/ana/.argus/accounts/${account}`) : null,
  sharedLoginReady: async () => {},
  alignWslIdentity: async (_distro: string, _info: unknown, account: string) => {
    fake.aligned.push(account)
  }
}))

import { wslLaunch, wslSdkProcess } from './launch'

const INFO = { home: '/home/ana', path: '', claude: '/usr/bin/claude' }
type Build = (info: typeof INFO) => Promise<{ argv: string[]; env: Record<string, string>; cwd: string }>
const envOf = async (account: string | undefined, env: Record<string, string> = {}) =>
  (await (wslSdkProcess('Ubuntu', { args: [], env }, account) as unknown as Build)(INFO)).env

beforeEach(() => {
  fake.shared = true
  fake.aligned = []
  fake.winEnv = {}
})

describe('wslSdkProcess', () => {
  // 2026-11-12: a conversa do WSL usava um login guardado lá dentro, que podia ser de outra conta.
  it('login compartilhado: o claude de lá lê o login na pasta da conta no Windows', async () => {
    expect(await envOf('main')).toEqual({ CLAUDE_SECURESTORAGE_CONFIG_DIR: '/mnt/c/Users/ana/.claude' })
    expect(await envOf('ab12cd34')).toEqual({
      CLAUDE_CONFIG_DIR: '/home/ana/.argus/accounts/ab12cd34',
      CLAUDE_SECURESTORAGE_CONFIG_DIR: '/mnt/c/Users/ana/.argus/accounts/ab12cd34'
    })
    expect(fake.aligned).toEqual(['main', 'ab12cd34'])
  })

  it('login separado: só a pasta da conta, como antes', async () => {
    fake.shared = false
    expect(await envOf('main')).toEqual({})
    expect(await envOf('ab12cd34')).toEqual({ CLAUDE_CONFIG_DIR: '/home/ana/.argus/accounts/ab12cd34' })
    expect(fake.aligned).toEqual([])
  })

  it('conta extra: uma credencial no ambiente do Windows não toma o lugar do login dela', async () => {
    expect(await envOf('ab12cd34', { ANTHROPIC_API_KEY: 'k', TERM: 'x' })).toMatchObject({ TERM: 'x' })
    expect(await envOf('ab12cd34', { ANTHROPIC_API_KEY: 'k' })).not.toHaveProperty('ANTHROPIC_API_KEY')
    expect(await envOf('main', { ANTHROPIC_API_KEY: 'k' })).toHaveProperty('ANTHROPIC_API_KEY', 'k')
  })
})

// O shell do terminal de uma pasta do WSL. Até a 0.1.124 abria sem nada da conta, e um `claude`
// digitado nele usava o login próprio do Linux, que podia ser de outra conta.
describe('wslLaunch: shell', () => {
  const CWD = '/home/ana/projeto'
  const shell = async (account?: string) => {
    const l = await wslLaunch('Ubuntu', { shell: true, account, cwd: CWD })
    if (!l.ok) throw new Error(l.error)
    return l
  }

  it('conta extra com o login compartilhado: a pasta e o lugar do login vão para o Linux pelo WSLENV', async () => {
    fake.winEnv = { Path: 'C:\\Windows', USERPROFILE: 'C:\\Users\\ana', WSLENV: 'USERPROFILE/p' }
    const l = await shell('ab12cd34')
    expect(l.file).toBe('wsl.exe')
    expect(l.args).toEqual(['-d', 'Ubuntu', '--cd', CWD])
    expect(l.account).toBe('ab12cd34')
    expect(l.env).toEqual({
      Path: 'C:\\Windows',
      USERPROFILE: 'C:\\Users\\ana',
      CLAUDE_CONFIG_DIR: '/home/ana/.argus/accounts/ab12cd34',
      CLAUDE_SECURESTORAGE_CONFIG_DIR: '/mnt/c/Users/ana/.argus/accounts/ab12cd34',
      WSLENV: 'USERPROFILE/p:CLAUDE_CONFIG_DIR/u:CLAUDE_SECURESTORAGE_CONFIG_DIR/u'
    })
    // A pasta da conta é preparada no Linux antes, como para o claude do terminal.
    expect(fake.aligned).toEqual(['ab12cd34'])
  })

  it('principal: só o lugar do login; uma pasta de configuração do Windows não passa', async () => {
    fake.winEnv = { CLAUDE_CONFIG_DIR: 'C:\\outra', WSLENV: 'CLAUDE_CONFIG_DIR/p' }
    expect((await shell()).env).toEqual({
      CLAUDE_SECURESTORAGE_CONFIG_DIR: '/mnt/c/Users/ana/.claude',
      WSLENV: 'CLAUDE_SECURESTORAGE_CONFIG_DIR/u'
    })
  })

  it('conta extra: uma credencial que a pessoa passe ao Linux pelo WSLENV não toma o lugar do login dela', async () => {
    fake.winEnv = { ANTHROPIC_API_KEY: 'k', WSLENV: 'ANTHROPIC_API_KEY:GOPATH/l' }
    const extra = await shell('ab12cd34')
    expect(extra.env).not.toHaveProperty('ANTHROPIC_API_KEY')
    expect(extra.env.WSLENV).toBe('GOPATH/l:CLAUDE_CONFIG_DIR/u:CLAUDE_SECURESTORAGE_CONFIG_DIR/u')
    // Na principal fica, como no terminal do Windows.
    expect((await shell()).env).toMatchObject({ ANTHROPIC_API_KEY: 'k', WSLENV: 'ANTHROPIC_API_KEY:GOPATH/l:CLAUDE_SECURESTORAGE_CONFIG_DIR/u' })
  })

  it('login separado: a conta extra leva só a pasta dela; a principal, nada (sem WSLENV vazio)', async () => {
    fake.shared = false
    expect((await shell('ab12cd34')).env).toEqual({
      CLAUDE_CONFIG_DIR: '/home/ana/.argus/accounts/ab12cd34',
      WSLENV: 'CLAUDE_CONFIG_DIR/u'
    })
    expect((await shell()).env).toEqual({})
  })
})

