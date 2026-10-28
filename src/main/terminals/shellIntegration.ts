import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import bashInit from './shellIntegration/init.bash?raw'
import pwshInit from './shellIntegration/init.ps1?raw'
import zshHooks from './shellIntegration/hooks.zsh?raw'
import zlogin from './shellIntegration/zlogin.zsh?raw'
import zprofile from './shellIntegration/zprofile.zsh?raw'
import zshenv from './shellIntegration/zshenv.zsh?raw'
import zshrc from './shellIntegration/zshrc.zsh?raw'

// Integração do Argus com o shell do drawer: o shell abre carregando os arquivos de sempre da pessoa
// e depois liga as marcas OSC 133 (ver shellMarks.ts), que dizem quando um comando começa, quando
// termina e com que código. É por elas que o Claude sabe o fim do comando que rodou (drawerShells.ts).
// Como o VS Code e o Claude Desktop fazem: zsh pelo ZDOTDIR, bash pelo --init-file e PowerShell por
// um comando que roda depois dos perfis. Outros shells (fish, sh) abrem como sempre, sem marcas.

export type ShellKind = 'zsh' | 'bash' | 'pwsh'

// Cada marca leva este nonce, que o shell lê de um arquivo e apaga (numa variável de ambiente, os
// programas abertos por ele também o veriam). nonceFile: o arquivo, para apagar se o shell não o leu.
export type IntegratedShell = { file: string; args: string[]; nonce?: string; nonceFile?: string }

// Os scripts, pelo caminho dentro da pasta da integração.
const SCRIPTS: Record<string, string> = {
  'zsh/.zshenv': zshenv,
  'zsh/.zprofile': zprofile,
  'zsh/.zshrc': zshrc,
  'zsh/.zlogin': zlogin,
  'zsh/hooks.zsh': zshHooks,
  'bash/init.bash': bashInit,
  'pwsh/init.ps1': pwshInit
}

// O PowerShell lê o script como texto e roda em memória: a política de execução, que barra arquivos
// .ps1 no Windows, não vale para isso. No modo de linguagem restrito (empresa com AppLocker) não
// carrega, e o shell abre como sempre.
const PWSH_LOADER = 'try { . ([ScriptBlock]::Create([System.IO.File]::ReadAllText($env:ARGUS_SHELL_HOOKS))) } catch { }'

// Nonce que nenhum shell leu (o shell não subiu): sai na próxima vez que o app abrir um shell.
const STALE_NONCE_MS = 60 * 60 * 1000

export function shellKind(file: string): ShellKind | null {
  const name = (file.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.exe$/, '')
  if (name === 'zsh' || name === 'bash') return name
  if (name === 'pwsh' || name === 'powershell') return 'pwsh'
  return null
}

let written: string | null = null

// Grava os scripts uma vez por execução do app (a versão nova do app troca os da antiga). Cada um vai
// inteiro (grava ao lado e renomeia): um shell abrindo na hora não lê um arquivo pela metade.
function scriptsDir(): string | null {
  if (written && existsSync(join(written, 'zsh', '.zshrc'))) return written
  const dir = join(app.getPath('userData'), 'shell-integration')
  try {
    for (const [name, content] of Object.entries(SCRIPTS)) {
      const path = join(dir, name)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(`${path}.tmp`, content)
      renameSync(`${path}.tmp`, path)
    }
    mkdirSync(join(dir, 'nonces'), { recursive: true })
    sweepNonces(join(dir, 'nonces'))
    return (written = dir)
  } catch (err) {
    console.warn('[terminal] sem a integração do shell:', err)
    return null
  }
}

function sweepNonces(dir: string): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    try {
      if (Date.now() - statSync(path).mtimeMs > STALE_NONCE_MS) rmSync(path, { force: true })
    } catch {
      // Apagado por outro shell no meio da limpeza.
    }
  }
}

// Shell com a integração: os argumentos dele e as variáveis que ela usa (gravadas em env). Shell sem
// integração, ou sem onde gravar os scripts: o mesmo shell, sem nonce.
export function integrateShell(shell: { file: string; args: string[] }, env: Record<string, string>): IntegratedShell {
  const kind = shellKind(shell.file)
  const dir = kind && scriptsDir()
  if (!kind || !dir) return shell
  const nonce = randomBytes(16).toString('hex')
  const nonceFile = join(dir, 'nonces', randomUUID())
  try {
    writeFileSync(nonceFile, nonce, { mode: 0o600 })
  } catch {
    return shell
  }
  env.ARGUS_SHELL_NONCE_FILE = nonceFile
  if (kind === 'zsh') {
    // A pasta da pessoa (vazia: a pessoal), para os arquivos daqui carregarem os dela.
    env.ARGUS_USER_ZDOTDIR = env.ZDOTDIR ?? ''
    env.ZDOTDIR = join(dir, 'zsh')
    return { ...shell, nonce, nonceFile }
  }
  if (kind === 'bash') {
    // Com o --init-file o bash não é de login: o script carrega o /etc/profile e o ~/.bash_profile.
    const login = shell.args.some((a) => a === '-l' || a === '--login')
    if (login) env.ARGUS_SHELL_LOGIN = '1'
    const args = shell.args.filter((a) => a !== '-l' && a !== '--login')
    return { file: shell.file, args: ['--init-file', join(dir, 'bash', 'init.bash'), ...args], nonce, nonceFile }
  }
  env.ARGUS_SHELL_HOOKS = join(dir, 'pwsh', 'init.ps1')
  return { file: shell.file, args: [...shell.args, '-NoExit', '-Command', PWSH_LOADER], nonce, nonceFile }
}

// Nonce que o shell não chegou a ler e apagar (fechado antes de subir).
export function dropNonce(file: string | undefined): void {
  if (!file) return
  try {
    rmSync(file, { force: true })
  } catch {
    // Some com a próxima limpeza.
  }
}
