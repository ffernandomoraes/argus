import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

// O que muda entre macOS e Windows no processo principal. O resto do app pergunta daqui, em vez de
// testar o sistema em cada canto.

export const IS_WIN = process.platform === 'win32'
export const IS_MAC = process.platform === 'darwin'

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

// Ambiente para os programas que o app abre, sem as variáveis do Electron: com elas, um `claude`
// ou um projeto Electron subiria como Node puro.
export function childEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_NO_ATTACH_CONSOLE
  return env
}

// Mac: pastas do PATH do shell de login da pessoa (carrega .zprofile e .zshrc, como o Terminal).
// O .zshrc pode escrever outras coisas antes: vale só a linha marcada. Sem resposta em 5 s ou com
// erro, lista vazia.
const PATH_MARK = '__ARGUS_PATH__'
export function loginShellPath(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(process.env.SHELL || '/bin/zsh', ['-ilc', `echo "${PATH_MARK}$PATH"`], { timeout: 5000 }, (_err, stdout) => {
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

// Caminho absoluto no Mac: aberto pelo Dock, o app não herda o PATH do terminal. No Windows, o do
// Git for Windows (entra no PATH do usuário na instalação; se não entrou, nas pastas padrão).
let git: string | null = null
export function gitPath(): string {
  if (git) return git
  if (!IS_WIN) return (git = '/usr/bin/git')
  const installs = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs')]
    .filter((d): d is string => !!d)
    .map((d) => join(d, 'Git', 'cmd', 'git.exe'))
  // Só guarda quando acha: instalado com o app aberto, aparece na próxima conferência.
  const found = findInPath('git') ?? installs.find((p) => existsSync(p))
  if (found) git = found
  return found ?? 'git'
}

// Windows: o Git for Windows está instalado? O Claude Code roda os comandos dele pelo Git Bash.
// No Mac o git vem com o sistema.
export function gitFound(): boolean {
  return !IS_WIN || gitPath() !== 'git'
}

// Shell dos terminais. No Mac, o de login da pessoa (carrega .zprofile e .zshrc, como o Terminal).
// No Windows, o PowerShell: o 7 (pwsh) se estiver instalado, senão o que vem com o sistema.
export function defaultShell(): { file: string; args: string[] } {
  if (!IS_WIN) return { file: process.env.SHELL || '/bin/zsh', args: ['-l'] }
  const pwsh = findInPath('pwsh')
  return { file: pwsh ?? WINDOWS_POWERSHELL, args: ['-NoLogo'] }
}
