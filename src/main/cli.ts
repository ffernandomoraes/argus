import { execFile } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { app } from 'electron'
import type { CliStatus } from '../shared/cli'
import { getPath, IS_WIN } from './platform'
import { powershell } from './winProcesses'

// Comando `argus`, o `code .` deste app: em qualquer terminal, `argus .` abre a pasta no canvas.
// No Mac, o script manda o caminho por um socket local; o app escuta enquanto está aberto. No
// Windows, o argus.cmd abre o Argus.exe com a pasta, e o app já aberto recebe dele o pedido (o
// Windows deixa uma instância só, ver index.ts).
// O pnpm dev usa outra pasta: aberto depois, tomaria o socket e o script do instalado.
const DIR_NAME = app.isPackaged ? '.argus' : '.argus-dev'
const DIR = join(homedir(), DIR_NAME)
export const CLI_BIN = join(DIR, 'bin')
const SCRIPT = join(CLI_BIN, IS_WIN ? 'argus.cmd' : 'argus')
const SOCKET = join(DIR, 'app.sock')
// Já está no PATH de quem usa o instalador do Claude Code; não pede senha de administrador.
const LINK = join(homedir(), '.local', 'bin', IS_WIN ? 'argus.cmd' : 'argus')
// Linha que marca o argus.cmd de ~/.local/bin como deste app (no Windows ele é cópia, não link).
const MARK = `rem argus-app ${DIR_NAME}`

// Argumento com que o argus.cmd abre o app. Um só, com "=": o Windows pode mudar a ordem dos
// argumentos ao repassar para a instância aberta.
export const OPEN_FLAG = '--open='

export function openArg(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith(OPEN_FLAG))
  return arg ? arg.slice(OPEN_FLAG.length) : null
}

// Pasta pedida pelo `argus .` no Windows: precisa existir e ser pasta. Volta com as maiúsculas
// como estão no disco, porque o Claude Code nomeia o histórico pelo caminho: "c:\proj" não acharia
// as conversas de "C:\Proj".
export function validFolder(path: string | null | undefined): string | null {
  if (!path || !isAbsolute(path)) return null
  try {
    if (!statSync(path).isDirectory()) return null
    return IS_WIN ? realpathSync.native(path) : path
  } catch {
    return null
  }
}

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

function script(): string {
  // Empacotado, o comando abre o app se ele estiver fechado. Em desenvolvimento não há .app para abrir.
  const bundle = app.isPackaged ? process.execPath.replace(/\.app\/.*$/, '.app') : null
  const launch = bundle
    ? `open -a ${quote(bundle)} && for _ in $(seq 1 50); do sleep 0.2; send && exit 0; done\n`
    : ''
  return `#!/bin/sh
# Gerado pelo Argus a cada vez que o app abre; mudanças aqui se perdem.
target="\${1:-.}"
dir=$(cd "$target" 2>/dev/null && pwd -P) || { echo "argus: pasta não encontrada: $target" >&2; exit 1; }
send() { curl -sf --unix-socket ${quote(SOCKET)} --data-binary "$dir" http://argus/open >/dev/null 2>&1; }
send && exit 0
${launch}echo "argus: o app não está aberto." >&2
exit 1
`
}

// O cmd lê o .bat linha a linha na página de código do console, que não é UTF-8: o script troca
// para UTF-8 na primeira linha (só com ASCII antes dela) e devolve a original ao sair. Assim o
// caminho do app e a mensagem com acento chegam certos, inclusive com usuário "João".
// Pasta de disco ("C:\") ganha um ponto no fim: a barra antes da aspa viraria aspa literal.
function windowsScript(): string {
  return [
    '@echo off',
    MARK,
    'rem Gerado pelo Argus a cada vez que o app abre; mudanças aqui se perdem.',
    'setlocal',
    `for /f "tokens=2 delims=:." %%a in ('chcp') do set /a "argus_cp=%%a"`,
    'chcp 65001 >nul',
    'set "target=%~1"',
    'if "%target%"=="" set "target=."',
    'if not exist "%target%\\*" goto missing',
    'for %%I in ("%target%") do set "dir=%%~fI"',
    'if "%dir:~-1%"=="\\" set "dir=%dir%."',
    `start "" ${launchCommand()} "${OPEN_FLAG}%dir%"`,
    'chcp %argus_cp% >nul',
    'exit /b 0',
    '',
    ':missing',
    'echo argus: pasta não encontrada: %target% 1>&2',
    'chcp %argus_cp% >nul',
    'exit /b 1',
    ''
  ].join('\r\n')
}

// Empacotado: o Argus.exe. No pnpm dev: o electron.exe com a pasta do projeto.
function launchCommand(): string {
  return app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${app.getAppPath()}"`
}

export class Cli {
  private server: Server | null = null

  constructor(private onOpen: (path: string) => void) {}

  start(): void {
    mkdirSync(CLI_BIN, { recursive: true })
    if (IS_WIN) {
      writeFileSync(SCRIPT, windowsScript())
      return
    }
    writeFileSync(SCRIPT, script(), { mode: 0o755 })
    // Socket que sobrou de um app que fechou sem limpar: sem apagar, o listen falha.
    try {
      unlinkSync(SOCKET)
    } catch {
      // não havia
    }
    this.server = createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/open') {
        res.statusCode = 404
        return void res.end()
      }
      let body = ''
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => (body += chunk))
      req.on('end', () => {
        const path = body.trim()
        const ok = path.startsWith('/') && existsSync(path) && statSync(path).isDirectory()
        if (ok) this.onOpen(path)
        res.statusCode = ok ? 200 : 400
        res.end()
      })
    })
    this.server.on('error', (err) => console.error('argus:', err.message))
    this.server.listen(SOCKET)
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }
}

// O que está em ~/.local/bin/argus: o link para o script deste app, outro programa ou nada. No
// Windows é uma cópia pequena que chama o script (link pediria administrador), marcada como nossa.
function linkTarget(): string | null {
  try {
    // Linha inteira: "rem argus-app .argus" também está dentro de "rem argus-app .argus-dev".
    if (IS_WIN) return readFileSync(LINK, 'utf8').split(/\r?\n/).includes(MARK) ? SCRIPT : 'outro'
    return lstatSync(LINK).isSymbolicLink() ? readlinkSync(LINK) : 'outro'
  } catch {
    return null
  }
}

// PATH do shell de login da pessoa, para avisar se ~/.local/bin não está nele.
function loginPath(): Promise<string> {
  return new Promise((resolve) => {
    execFile(process.env.SHELL || '/bin/zsh', ['-ilc', 'echo "$PATH"'], { timeout: 5000 }, (_err, stdout) =>
      resolve(stdout.trim().split('\n').pop() ?? '')
    )
  })
}

// PATH do usuário no Windows, como fica gravado (vale para os terminais abertos daqui em diante).
// Pelo PowerShell, que devolve em UTF-8: o reg.exe trocaria o acento de "C:\Users\João".
async function windowsUserPath(): Promise<string> {
  return (await powershell(`[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment').GetValue('Path', '')`)).trim()
}

// Acrescenta ~/.local/bin ao PATH do usuário, sem administrador. Grava pelo registro, mantendo
// o tipo e as referências como %USERPROFILE% (o SetEnvironmentVariable as expandiria), e avisa o
// Windows da mudança criando e apagando uma variável: os terminais abertos depois já veem.
const ADD_TO_PATH = `$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
$old = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$new = (@($old.TrimEnd(';'), '%USERPROFILE%\\.local\\bin') | Where-Object { $_ }) -join ';'
$key.SetValue('Path', $new, [Microsoft.Win32.RegistryValueKind]::ExpandString)
$key.Close()
[Environment]::SetEnvironmentVariable('ARGUS_PATH_REFRESH', '1', 'User')
[Environment]::SetEnvironmentVariable('ARGUS_PATH_REFRESH', $null, 'User')`

const samePath = (a: string, b: string) => a.replace(/[\\/]+$/, '').toLowerCase() === b.replace(/[\\/]+$/, '').toLowerCase()

async function binInPath(): Promise<boolean> {
  const dir = dirname(LINK)
  if (!IS_WIN) return (await loginPath()).split(':').includes(dir)
  const dirs = [...getPath().split(delimiter), ...(await windowsUserPath()).split(delimiter)]
  return dirs.some((d) => d && samePath(d, dir))
}

export async function cliStatus(): Promise<CliStatus> {
  const target = linkTarget()
  if (target === null) return { installed: false }
  if (target !== SCRIPT) return { installed: false, error: `Já existe outro comando em ${LINK.replace(homedir(), '~')}.` }
  if (await binInPath()) return { installed: true }
  const warning = IS_WIN
    ? 'Adicione %USERPROFILE%\\.local\\bin ao PATH do Windows para o comando funcionar.'
    : 'Adicione ~/.local/bin ao PATH do seu shell para o comando funcionar.'
  return { installed: true, warning }
}

export async function installCli(): Promise<CliStatus> {
  const target = linkTarget()
  if (target === null) {
    mkdirSync(dirname(LINK), { recursive: true })
    if (IS_WIN) {
      // %USERPROFILE% em vez do caminho escrito: o cmd não lê acento no nome do usuário.
      writeFileSync(LINK, ['@echo off', MARK, `call "%USERPROFILE%\\${DIR_NAME}\\bin\\argus.cmd" %*`, ''].join('\r\n'))
      // O instalador do Claude Code costuma pôr ~/.local/bin no PATH; se não pôs, entra agora.
      if (!(await binInPath())) await powershell(ADD_TO_PATH)
    } else symlinkSync(SCRIPT, LINK)
  }
  return cliStatus()
}

export async function uninstallCli(): Promise<CliStatus> {
  // Só remove o link que é deste app; um `argus` de outro programa fica onde está.
  if (linkTarget() === SCRIPT) unlinkSync(LINK)
  return cliStatus()
}
