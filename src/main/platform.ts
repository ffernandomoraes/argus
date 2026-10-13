import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { userInfo } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'

// O que muda entre macOS e Windows no processo principal. O resto do app pergunta daqui, em vez de
// testar o sistema em cada canto.

export const IS_WIN = process.platform === 'win32'
export const IS_MAC = process.platform === 'darwin'
export const IS_LINUX = process.platform === 'linux'

// Pasta dos programas do Windows (cmd, powershell, taskkill...), pelo caminho completo: não depende
// do PATH de quem abriu o app.
export const SYSTEM32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
// O PowerShell que vem com o Windows (o 5): existe em todo Windows, ao contrário do 7 (pwsh).
export const WINDOWS_POWERSHELL = join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe')

// App aberto pelo Finder não herda o PATH do terminal: o Homebrew e afins entram à mão. No Windows
// o app recebe do Explorador o PATH do usuário, que já tem o Node, o git e o claude.
const EXTRA_BIN = IS_MAC ? ['/opt/homebrew/bin', '/usr/local/bin'] : []

// No Windows a variável se chama "Path", e o objeto copiado do process.env diferencia maiúsculas:
// gravar "PATH" nele criaria uma segunda variável, e o programa aberto veria só uma das duas.
function pathKey(env: Record<string, string | undefined>): string {
  return IS_WIN ? (Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path') : 'PATH'
}

export function getPath(env: Record<string, string | undefined> = process.env): string {
  return env[pathKey(env)] ?? ''
}

// Põe as pastas na frente do PATH, junto com as dos programas comuns do sistema. Só pastas
// absolutas: sem achar o `claude`, o dirname do nome solto é ".", e um "." na frente do PATH
// rodaria o `claude` (ou `git`, `node`) que estiver na raiz do repositório aberto no lugar do
// verdadeiro.
export function prependPath(env: Record<string, string>, dirs: (string | undefined)[]): void {
  const key = pathKey(env)
  const extra = [...dirs, ...EXTRA_BIN].filter((d): d is string => !!d && isAbsolute(d))
  env[key] = [...extra, env[key]].filter(Boolean).join(delimiter)
}

// Shell de login da pessoa (Mac e Linux). O app aberto pelo menu de apps do Linux pode vir sem
// SHELL no ambiente; aí vale o cadastrado para o usuário e, por fim, o bash (o zsh não vem no
// Linux).
export function userShell(): string {
  if (process.env.SHELL) return process.env.SHELL
  try {
    const shell = userInfo().shell
    if (shell) return shell
  } catch {
    // sem cadastro do usuário
  }
  return IS_MAC ? '/bin/zsh' : '/bin/bash'
}

// Ambiente para os programas que o app abre, sem as variáveis do Electron: com elas, um `claude`
// ou um projeto Electron subiria como Node puro.
export function childEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  if (IS_LINUX) withoutAppImage(env)
  return env
}

// Linux: o AppImage abre o app com variáveis que apontam para a cópia montada dele em /tmp (APPDIR)
// e com as pastas dela na frente do LD_LIBRARY_PATH e do PATH. Herdadas, fariam o git, o claude e o
// terminal carregarem as bibliotecas do app no lugar das do sistema. As listas são limpas uma vez,
// na abertura, para todo programa que o app roda (mesmo os sem ambiente próprio); as marcas do
// AppImage saem só do ambiente dos programas abertos (o atualizador e o atalho usam o APPIMAGE).
const APPIMAGE_LISTS = ['LD_LIBRARY_PATH', 'PATH', 'XDG_DATA_DIRS', 'GSETTINGS_SCHEMA_DIR']

function stripAppDir(env: Record<string, string | undefined>, appDir: string): void {
  for (const key of APPIMAGE_LISTS) {
    const value = env[key]
    if (!value) continue
    const kept = value.split(':').filter((p) => p && !p.startsWith(appDir))
    if (kept.length) env[key] = kept.join(':')
    else delete env[key]
  }
}

export function cleanAppImageEnv(): void {
  if (IS_LINUX && process.env.APPDIR) stripAppDir(process.env, process.env.APPDIR)
}

function withoutAppImage(env: Record<string, string>): void {
  if (env.APPDIR) stripAppDir(env, env.APPDIR)
  for (const key of ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD']) delete env[key]
}

// Mac: pastas do PATH do shell de login da pessoa (carrega .zprofile e .zshrc, como o Terminal).
// O .zshrc pode escrever outras coisas antes: vale só a linha marcada. Sem resposta em 5 s ou com
// erro, lista vazia.
const PATH_MARK = '__ARGUS_PATH__'
export function loginShellPath(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(userShell(), ['-ilc', `echo "${PATH_MARK}$PATH"`], { timeout: 5000 }, (_err, stdout) => {
      const line = String(stdout ?? '')
        .split('\n')
        .find((l) => l.startsWith(PATH_MARK))
      resolve(line ? line.slice(PATH_MARK.length).trim().split(':').filter(Boolean) : [])
    })
  })
}

// Programa pelo nome nas pastas do PATH. No Windows, com a extensão (claude.exe, claude.cmd).
export function findInPath(name: string, exts: string[] = IS_WIN ? ['.exe'] : ['']): string | null {
  for (const dir of getPath().split(delimiter).filter(Boolean)) {
    for (const ext of exts) {
      const full = join(dir, name + ext)
      if (existsSync(full)) return full
    }
  }
  return null
}

// Caminho absoluto no Mac: aberto pelo Dock, o app não herda o PATH do terminal. No Linux, o do
// PATH (o Ubuntu Desktop não traz o git: só existe depois de instalado). No Windows, o do Git for
// Windows (entra no PATH do usuário na instalação; se não entrou, nas pastas padrão).
let git: string | null = null
export function gitPath(): string {
  if (git) return git
  if (IS_MAC) return (git = '/usr/bin/git')
  if (IS_LINUX) {
    const found = findInPath('git') ?? ['/usr/bin/git', '/usr/local/bin/git'].find((p) => existsSync(p))
    if (found) git = found
    return found ?? 'git'
  }
  const installs = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')]
    .filter((d): d is string => !!d)
    .map((d) => join(d, 'Git', 'cmd', 'git.exe'))
  // Só guarda quando acha: instalado com o app aberto, aparece na próxima conferência.
  const found = findInPath('git') ?? installs.find((p) => existsSync(p))
  if (found) git = found
  return found ?? 'git'
}

// O git está instalado? No Windows, o Git for Windows (o Claude Code roda os comandos pelo Git
// Bash); no Linux, o do sistema. No Mac ele vem com o sistema.
export function gitFound(): boolean {
  return IS_MAC || gitPath() !== 'git'
}

// Shell dos terminais. No Mac e no Linux, o de login da pessoa (carrega .zprofile e .zshrc, ou o
// .profile e o .bashrc, como o terminal do sistema). No Windows, o PowerShell: o 7 (pwsh) se estiver
// instalado, senão o que vem com o sistema.
export function defaultShell(): { file: string; args: string[] } {
  if (!IS_WIN) return { file: userShell(), args: ['-l'] }
  const pwsh = findInPath('pwsh')
  return { file: pwsh ?? WINDOWS_POWERSHELL, args: ['-NoLogo'] }
}
