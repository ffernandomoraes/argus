import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { claudeCodeOptions, claudeEnv, FOLDERS_CLAUDE_MD } from './env'

// Sem procurar o `claude` de verdade nem o WSL: o binário é sempre o mesmo, a conta só marca o
// ambiente e "\\wsl.localhost\..." é a única pasta que roda no Linux.
const CLAUDE = join('/opt', 'claude', 'bin', 'claude')

vi.mock('../claudePath', () => ({
  claudePath: () => CLAUDE,
  claudeHeld: () => false,
  claudeReady: () => Promise.resolve(),
  claudeCommand: (args: string[], claude: string) => ({ file: claude, args })
}))
vi.mock('../accounts', () => ({
  applyAccount: (env: Record<string, string>, id?: string) => {
    delete env.CLAUDE_CONFIG_DIR
    if (id) env.CLAUDE_CONFIG_DIR = `/contas/${id}`
    return id ?? 'main'
  }
}))
vi.mock('../wsl', async () => {
  const path = await vi.importActual<typeof import('../wsl/path')>('../wsl/path')
  return {
    toLinux: path.toLinux,
    distroFor: (p?: string) => path.parseWslPath(p ?? '')?.distro ?? null,
    distroInfo: () => ({ claude: '/home/ana/.local/bin/claude' })
  }
})
vi.mock('../wsl/launch', () => ({ wslLaunch: vi.fn(), wslSdkProcess: vi.fn() }))

const ARTIFACT = 'CLAUDE_CODE_ARTIFACT'

afterEach(() => {
  delete process.env[ARTIFACT]
})

describe('claudeCodeOptions', () => {
  // c42be77: pelo SDK a ferramenta de artefatos vinha desligada; as conversas não conseguiam publicar.
  it('liga a ferramenta de artefatos como no terminal', () => {
    expect(claudeCodeOptions('/Users/ana/proj').env?.[ARTIFACT]).toBe('1')
  })

  it('quem desligou os artefatos no próprio ambiente continua com eles desligados', () => {
    process.env[ARTIFACT] = '0'
    expect(claudeCodeOptions('/Users/ana/proj').env?.[ARTIFACT]).toBe('0')
  })

  it('pastas do workspace entram como adicionais, com o CLAUDE.md de cada uma', () => {
    const o = claudeCodeOptions('~/proj', undefined, ['~/a', '/srv/b'])
    expect(o.cwd).toBe(join(homedir(), 'proj'))
    expect(o.additionalDirectories).toEqual([join(homedir(), 'a'), '/srv/b'])
    expect(o.env?.[FOLDERS_CLAUDE_MD]).toBe('1')
  })

  it('sem pastas adicionais, nem a opção nem a lista vão', () => {
    const o = claudeCodeOptions('/Users/ana/proj')
    expect(o).not.toHaveProperty('additionalDirectories')
    expect(o.env).not.toHaveProperty(FOLDERS_CLAUDE_MD)
  })

  it('o Claude Code abre com o prompt dele, como no terminal', () => {
    expect(claudeCodeOptions('/p').systemPrompt).toEqual({ type: 'preset', preset: 'claude_code' })
  })

  it('a conta escolhida decide a pasta de configuração', () => {
    expect(claudeCodeOptions('/p', 'trabalho').env?.CLAUDE_CONFIG_DIR).toBe('/contas/trabalho')
    expect(claudeCodeOptions('/p').env).not.toHaveProperty('CLAUDE_CONFIG_DIR')
  })

  it('no WSL, o `claude` do Linux e as pastas adicionais como o Linux enxerga', () => {
    const o = claudeCodeOptions('\\\\wsl.localhost\\Ubuntu\\home\\ana\\proj', undefined, ['C:\\Users\\ana\\docs', '\\\\wsl.localhost\\Ubuntu\\srv'])
    expect(o.pathToClaudeCodeExecutable).toBe('/home/ana/.local/bin/claude')
    expect(o.spawnClaudeCodeProcess).toBeTypeOf('function')
    expect(o.additionalDirectories).toEqual(['/mnt/c/Users/ana/docs', '/srv'])
    expect(o.env?.[ARTIFACT]).toBe('1')
  })
})

describe('claudeEnv', () => {
  it('a pasta do `claude` vem primeiro no PATH (o app aberto pelo Finder não tem o do terminal)', () => {
    const env = claudeEnv(CLAUDE)
    const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH')!
    expect(env[key].split(process.platform === 'win32' ? ';' : ':')[0]).toBe(dirname(CLAUDE))
  })

  it('sem as variáveis do Electron que fariam o `claude` subir como Node puro', () => {
    process.env.ELECTRON_RUN_AS_NODE = '1'
    try {
      expect(claudeEnv(CLAUDE)).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
    } finally {
      delete process.env.ELECTRON_RUN_AS_NODE
    }
  })
})
