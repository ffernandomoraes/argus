import { lstatSync, mkdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname } from 'node:path'
import type { CliStatus } from '../../shared/cli'
import { getPath, IS_WIN, loginShellPath } from '../platform'
import { powershell } from '../winProcesses'
import { DIR_NAME, LINK, MARK, SCRIPT } from './locations'

// Instalar o `argus` no PATH: um link em ~/.local/bin para o script deste app.

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
  // Mac: o PATH do shell de login da pessoa, para avisar se ~/.local/bin não está nele.
  if (!IS_WIN) return (await loginShellPath()).includes(dir)
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
