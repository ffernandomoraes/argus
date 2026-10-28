import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { childEnv, defaultShell, IS_WIN } from '../platform'
import { OutputBuffer } from './outputBuffer'
import { ShellActivity } from './shellActivity'
import { integrateShell } from './shellIntegration'

describe('integrateShell', () => {
  it('zsh: abre com o ZDOTDIR na pasta do Argus, lembrando o da pessoa', () => {
    const env: Record<string, string> = { ZDOTDIR: '/home/p/.config/zsh' }
    const shell = integrateShell({ file: '/bin/zsh', args: ['-l'] }, env)
    expect(shell.args).toEqual(['-l'])
    expect(env.ARGUS_USER_ZDOTDIR).toBe('/home/p/.config/zsh')
    expect(existsSync(join(env.ZDOTDIR, '.zshrc'))).toBe(true)
    expect(existsSync(join(env.ZDOTDIR, 'hooks.zsh'))).toBe(true)
    // O nonce vai num arquivo que o shell lê e apaga, não numa variável de ambiente.
    expect(readFileSync(env.ARGUS_SHELL_NONCE_FILE, 'utf8')).toBe(shell.nonce)
    expect(shell.nonceFile).toBe(env.ARGUS_SHELL_NONCE_FILE)
  })

  it('bash: --init-file no lugar do -l, que o script faz por ele', () => {
    const env: Record<string, string> = {}
    const shell = integrateShell({ file: '/usr/bin/bash', args: ['-l'] }, env)
    expect(shell.args).toEqual(['--init-file', expect.stringMatching(/init\.bash$/)])
    expect(env.ARGUS_SHELL_LOGIN).toBe('1')
  })

  it('PowerShell: lê o script como texto depois dos perfis', () => {
    const env: Record<string, string> = {}
    const shell = integrateShell({ file: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe', args: ['-NoLogo'] }, env)
    expect(shell.args.slice(0, 3)).toEqual(['-NoLogo', '-NoExit', '-Command'])
    expect(shell.args[3]).toContain('$env:ARGUS_SHELL_HOOKS')
    expect(env.ARGUS_SHELL_HOOKS).toMatch(/init\.ps1$/)
  })

  it('outro shell (fish): abre como sempre, sem nonce', () => {
    const env: Record<string, string> = {}
    expect(integrateShell({ file: '/usr/bin/fish', args: ['-l'] }, env)).toEqual({ file: '/usr/bin/fish', args: ['-l'] })
    expect(env).toEqual({})
  })
})

// O shell de verdade, pelo node-pty, como o drawer abre. No Linux o node-pty não traz binário pronto
// (e os testes instalam sem compilar): lá quem confere é o teste de fumaça (smokeTest.ts).
const pty = await import('node-pty').then((m) => (m as unknown as { default?: typeof m }).default ?? m).catch(() => null)
const shells = (IS_WIN ? [defaultShell()] : ['/bin/zsh', '/bin/bash'].filter(existsSync).map((file) => ({ file, args: ['-l'] }))).filter(() => !!pty)

const until = async (check: () => unknown, ms = 20_000) => {
  const deadline = Date.now() + ms
  while (!check()) {
    if (Date.now() > deadline) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe.skipIf(!shells.length)('shell de verdade com a integração', () => {
  it.each(shells)('$file marca o prompt e o fim de cada comando, com o código', async (shell) => {
    const env = childEnv()
    env.TERM = 'xterm-256color'
    const integrated = integrateShell(shell, env)
    const activity = new ShellActivity(integrated.nonce)
    const output = new OutputBuffer(200_000)
    // No Windows, o ConPTY que vem com o node-pty, como o app abre (ver spawnPty).
    const p = pty!.spawn(integrated.file, integrated.args, { name: 'xterm-256color', cols: 120, rows: 30, cwd: homedir(), env, useConptyDll: IS_WIN })
    p.onData((data) => {
      const start = output.end
      output.push(data)
      activity.output(data, start)
    })
    const run = async (command: string) => {
      const offset = output.end
      p.write(`${command}\r`)
      await until(() => activity.markAfter('A', offset))
      return activity.markAfter('D', offset)
    }
    try {
      await until(() => activity.marked)
      expect(existsSync(integrated.nonceFile!)).toBe(false)
      expect((await run('echo argus'))?.exitCode).toBe(0)
      expect((await run(IS_WIN ? 'cmd /c exit 3' : 'sh -c "exit 3"'))?.exitCode).toBe(3)
      // Enter sem comando: prompt novo, sem fim de comando.
      expect(await run('')).toBeUndefined()
      if (IS_WIN) {
        // O $LASTEXITCODE ainda é o 3 do programa de antes: o comando do PowerShell que falha dá 1.
        expect((await run('Get-Item argus-nao-existe'))?.exitCode).toBe(1)
        // Erro de sintaxe não roda nem mexe no $?: 1, não o 0 do comando de antes.
        await run('echo ok')
        expect((await run('echo um ) dois'))?.exitCode).toBe(1)
        // O mesmo programa falhando de novo, com o mesmo código.
        await run('cmd /c exit 3')
        expect((await run('cmd /c exit 3'))?.exitCode).toBe(3)
      }
      // O zsh devolve o ZDOTDIR da pessoa: sem valor, como sem o Argus.
      if (shell.file.endsWith('zsh')) {
        await run('echo "zd=${ZDOTDIR-nenhum}"')
        expect(output.text()).toContain('zd=nenhum')
      }
    } finally {
      // No Windows o shell sai depois de um instante e, até sair, segura a pasta em que roda (a
      // pessoal falsa, que o test/setup.ts apaga no fim do arquivo).
      const exited = new Promise<void>((resolve) => p.onExit(() => resolve()))
      p.kill()
      await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))])
    }
  }, 90_000)
})
