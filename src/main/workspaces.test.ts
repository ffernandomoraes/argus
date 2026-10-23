import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { describe, expect, it } from 'vitest'
import { folderArgs } from './workspaceFolders'
import { isWorkspaceDir, syncWorkspace, trustGemini } from './workspaces'

// Workspace: várias pastas num card. As conversas abrem numa pasta do Argus que só tem o aviso com
// a lista de pastas; se o aviso ou as pastas adicionais saem errados, o agente trabalha às cegas.

const ID = '12345678-1234-4123-8123-123456789abc'
const workspaceDir = (id = ID) => join(app.getPath('userData'), 'workspaces', id)

describe('isWorkspaceDir', () => {
  it('só a pasta …/workspaces/<uuid>', () => {
    expect(isWorkspaceDir(workspaceDir())).toBe(true)
    expect(isWorkspaceDir(join(homedir(), 'proj'))).toBe(false)
    expect(isWorkspaceDir(join(homedir(), 'workspaces', 'meu-projeto'))).toBe(false)
    expect(isWorkspaceDir(join(homedir(), 'outra', ID))).toBe(false)
  })
})

// No Windows, a pasta nova passa pela procura do `claude` e das distros do WSL (processos do
// sistema): lá vale o teste de abrir o app (--smoke-test).
describe.skipIf(process.platform === 'win32')('syncWorkspace', () => {
  it('cria a pasta nos dados do app, com o aviso para cada agente', async () => {
    const dir = await syncWorkspace(['~/front', '/abs/back'])
    expect(isWorkspaceDir(dir)).toBe(true)
    expect(dirname(dir)).toBe(join(app.getPath('userData'), 'workspaces'))
    for (const name of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
      const text = readFileSync(join(dir, name), 'utf8')
      expect(text).toContain(`- ${join(homedir(), 'front')}\n`)
      expect(text).toContain('- /abs/back\n')
    }
    // Sem isto o Gemini não lê o GEMINI.md das pastas adicionais.
    expect(JSON.parse(readFileSync(join(dir, '.gemini', 'settings.json'), 'utf8'))).toEqual({ context: { loadMemoryFromIncludeDirectories: true } })
  })

  it('cada workspace novo tem a sua pasta', async () => {
    expect(await syncWorkspace(['~/a'])).not.toBe(await syncWorkspace(['~/a']))
  })

  it('pôr ou tirar pasta reescreve o aviso na mesma pasta (o histórico fica preso a ela)', async () => {
    const dir = await syncWorkspace(['~/a', '~/b'])
    expect(await syncWorkspace(['~/a'], dir)).toBe(dir)
    const text = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
    expect(text).toContain(join(homedir(), 'a'))
    expect(text).not.toContain(join(homedir(), 'b'))
  })

  // O caminho vem da janela: só a pasta de workspace pode ser escrita.
  it('recusa escrever numa pasta que não é de workspace', async () => {
    const project = join(homedir(), 'proj')
    await expect(syncWorkspace(['~/a'], project)).rejects.toThrow()
    expect(existsSync(join(project, 'CLAUDE.md'))).toBe(false)
  })
})

describe('trustGemini', () => {
  const trusted = (home: string) => join(home, '.gemini', 'trustedFolders.json')

  it('põe a pasta do workspace nas confiáveis, sem tirar as que já estavam', () => {
    const home = join(homedir(), 'gemini-a')
    mkdirSync(join(home, '.gemini'), { recursive: true })
    writeFileSync(trusted(home), JSON.stringify({ '/outra': 'TRUST_PARENT' }))
    trustGemini(workspaceDir(), home)
    expect(JSON.parse(readFileSync(trusted(home), 'utf8'))).toEqual({ '/outra': 'TRUST_PARENT', [workspaceDir()]: 'TRUST_FOLDER' })
  })

  it('cria o arquivo quando não existe', () => {
    const home = join(homedir(), 'gemini-b')
    trustGemini(workspaceDir(), home)
    expect(JSON.parse(readFileSync(trusted(home), 'utf8'))).toEqual({ [workspaceDir()]: 'TRUST_FOLDER' })
  })

  it('pasta da pessoa não entra, e arquivo ilegível fica como está', () => {
    const home = join(homedir(), 'gemini-c')
    trustGemini(join(homedir(), 'proj'), home)
    expect(existsSync(trusted(home))).toBe(false)

    mkdirSync(join(home, '.gemini'), { recursive: true })
    writeFileSync(trusted(home), '{ // comentário\n}')
    trustGemini(workspaceDir(), home)
    expect(readFileSync(trusted(home), 'utf8')).toBe('{ // comentário\n}')
  })
})

describe('folderArgs', () => {
  it('cada agente com a opção dele, e "~" já expandido', () => {
    expect(folderArgs('claude', ['~/a', '/b'])).toEqual(['--add-dir', homedir() + '/a', '--add-dir', '/b'])
    expect(folderArgs('codex', ['/b'])).toEqual(['--add-dir', '/b'])
    expect(folderArgs('gemini', ['/b'])).toEqual(['--include-directories', '/b'])
    expect(folderArgs('claude')).toEqual([])
  })

  it('converte o caminho para o que o agente enxerga (WSL)', () => {
    expect(folderArgs('claude', ['C:\\x'], (p) => p.replace('C:\\', '/mnt/c/'))).toEqual(['--add-dir', '/mnt/c/x'])
  })
})
