import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { configScript, parseConfig } from './windowsConfig'

// O script que liga as configurações do Windows no ~/.claude do Linux, rodado de verdade num `sh`
// (fora do Windows): sem um Windows com WSL para testar, é aqui que um erro de sintaxe ou de aspas
// aparece. 2026-11-12: quem configura tudo no Windows não via as instruções, skills, agents e
// comandos de lá nas pastas do WSL.

const root = mkdtempSync(join(tmpdir(), 'argus-config-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

// O ~/.claude do Windows visto de dentro da distro, com espaço e aspas no caminho.
const win = join(root, 'Users', "Jo'ao Silva", '.claude')
mkdirSync(join(win, 'skills', 'revisar'), { recursive: true })
mkdirSync(join(win, 'agents'))
mkdirSync(join(win, 'commands'))
writeFileSync(join(win, 'CLAUDE.md'), '# do Windows\n')
writeFileSync(join(win, 'skills', 'revisar', 'SKILL.md'), '---\nname: revisar\n---\n')
writeFileSync(join(win, 'agents', 'do-windows.md'), 'agente\n')
writeFileSync(join(win, 'commands', 'oi.md'), 'oi\n')

const run = (home: string) =>
  execFileSync('sh', ['-s'], { input: configScript(win), encoding: 'utf8', timeout: 20_000, env: { PATH: '/usr/bin:/bin', HOME: home } })
const isLink = (path: string) => lstatSync(path).isSymbolicLink()

describe.skipIf(process.platform === 'win32')('configScript', () => {
  it('liga o que falta, troca pasta vazia pelo link e deixa o que é do Linux', () => {
    const home = join(root, 'home-a')
    // O Linux tem a sua pasta de agents (com coisa) e uma de comandos vazia.
    mkdirSync(join(home, '.claude', 'agents'), { recursive: true })
    writeFileSync(join(home, '.claude', 'agents', 'meu.md'), 'do Linux\n')
    mkdirSync(join(home, '.claude', 'commands'))

    expect(parseConfig(run(home))).toEqual({ 'CLAUDE.md': 'windows', skills: 'windows', agents: 'own', commands: 'windows', 'output-styles': 'none' })
    expect(readlinkSync(join(home, '.claude', 'CLAUDE.md'))).toBe(join(win, 'CLAUDE.md'))
    expect(readlinkSync(join(home, '.claude', 'skills'))).toBe(join(win, 'skills'))
    expect(readlinkSync(join(home, '.claude', 'commands'))).toBe(join(win, 'commands'))
    // A pasta do Linux ficou como estava.
    expect(isLink(join(home, '.claude', 'agents'))).toBe(false)
    expect(execFileSync('ls', [join(home, '.claude', 'agents')], { encoding: 'utf8' }).trim()).toBe('meu.md')

    // De novo: nada muda, e os links contam como do Windows.
    expect(parseConfig(run(home))).toEqual({ 'CLAUDE.md': 'windows', skills: 'windows', agents: 'own', commands: 'windows', 'output-styles': 'none' })
  })

  it('sem ~/.claude ainda (o Claude nunca rodou na distro): cria e liga tudo o que o Windows tem', () => {
    const home = join(root, 'home-b')
    mkdirSync(home)
    expect(parseConfig(run(home))).toEqual({ 'CLAUDE.md': 'windows', skills: 'windows', agents: 'windows', commands: 'windows', 'output-styles': 'none' })
  })

  it('arquivo ou link que é da pessoa fica, mesmo com o mesmo nome', () => {
    const home = join(root, 'home-c')
    mkdirSync(join(home, '.claude'), { recursive: true })
    writeFileSync(join(home, '.claude', 'CLAUDE.md'), 'do Linux\n')
    execFileSync('ln', ['-s', join(root, 'outro-lugar'), join(home, '.claude', 'skills')])
    const config = parseConfig(run(home))!
    expect(config['CLAUDE.md']).toBe('own')
    expect(config.skills).toBe('own')
    expect(readlinkSync(join(home, '.claude', 'skills'))).toBe(join(root, 'outro-lugar'))
  })
})

describe('parseConfig', () => {
  it('ignora o resto da saída e exige todos os itens', () => {
    const lines = ['bem-vindo ao Ubuntu', ...['CLAUDE.md', 'skills', 'agents', 'commands', 'output-styles'].map((p) => `__ARGUS_CFG__${p}=windows`)]
    expect(parseConfig(lines.join('\n'))?.skills).toBe('windows')
    expect(parseConfig(lines.slice(0, 3).join('\n'))).toBeNull()
    expect(parseConfig(lines.join('\n').replace('skills=windows', 'skills=talvez'))).toBeNull()
  })
})
