import { execFile, spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { resolveAccount } from '../accounts'
import { claudeLaunch } from '../chats'
import { IS_WIN } from '../platform'
import { ensureDistro, homeUnc } from '../wsl'
import { wslAccountDir, wslAccountsRoot, wslLoginDir } from '../wsl/accounts'
import { WSL_EXE } from '../wsl/distros'
import { placeOf } from './context'
import { scrub } from './scrub'

// Ferramentas do app para a investigação: conferências prontas, que só leem. O Claude que investiga
// não roda comando livre: o que ele precisa ver da máquina passa por aqui.

const OUTPUT_MAX = 20_000
const text = (t: string) => ({ content: [{ type: 'text' as const, text: scrub(t.length > OUTPUT_MAX ? `${t.slice(0, OUTPUT_MAX)}\n(cortado)` : t) }] })

// `claude auth status` da conta, rodando onde o projeto rodaria: é o mesmo `claude`, com as mesmas
// variáveis, que a conversa e o terminal daquela pasta usam.
async function loginStatus(account: string | undefined, cwd: string | undefined): Promise<string> {
  const id = resolveAccount(account)
  const head = `Conta ${id}, rodando em ${placeOf(cwd)}`
  const l = await claudeLaunch(['auth', 'status', '--json'], id, cwd)
  if (!l.ok) return `${head}\nNão abriu: ${l.error}`
  return new Promise((resolve) => {
    execFile(l.file, l.args, { env: l.env, cwd: l.cwd, timeout: 45_000, windowsHide: true }, (err, stdout, stderr) => {
      const out = [head, `saída: ${String(stdout).trim() || '(vazia)'}`]
      if (String(stderr).trim()) out.push(`erros: ${String(stderr).trim()}`)
      if (err) out.push(`código de saída: ${err.code ?? '?'} (${err.message.split('\n')[0]})`)
      resolve(out.join('\n'))
    })
  })
}

const sq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

// Roda dentro da distro, pelo stdin do `sh`. Só lista e confere: não grava nada.
const PROBE = `
echo "usuário: $(id -un)  home: $HOME"
echo "pasta da conta (CLAUDE_CONFIG_DIR): \${ACCOUNT_DIR:-(principal: ~/.claude)}"
echo "pasta do login (CLAUDE_SECURESTORAGE_CONFIG_DIR): \${LOGIN_DIR:-(a própria pasta da conta)}"
echo; echo "== claude"
if [ -n "$CLAUDE_BIN" ]; then "$CLAUDE_BIN" --version 2>&1; else echo "(não achado pelo app)"; fi
echo; echo "== pastas das contas ($ACCOUNTS_ROOT)"; ls -la "$ACCOUNTS_ROOT" 2>&1
if [ -n "$ACCOUNT_DIR" ]; then echo; echo "== pasta da conta"; ls -la "$ACCOUNT_DIR" 2>&1; fi
echo; echo "== ~/.claude"; ls -la "$HOME/.claude" 2>&1 | head -40
echo; echo "== arquivos de login"
for f in "$HOME/.claude/.credentials.json" "\${ACCOUNT_DIR:+$ACCOUNT_DIR/.credentials.json}" "\${LOGIN_DIR:+$LOGIN_DIR/.credentials.json}"; do
  [ -z "$f" ] && continue
  if [ -e "$f" ]; then echo "existe: $f ($(stat -c '%s bytes, modificado em %y' "$f" 2>/dev/null))"; else echo "não existe: $f"; fi
done
if [ -n "$LOGIN_DIR" ]; then echo; echo "== pasta do login vista do Linux"; ls -la "$LOGIN_DIR" 2>&1 | head -30; fi
echo; echo "== discos do Windows montados"; mount 2>/dev/null | grep -iE 'drvfs|9p' | head -10
echo; echo "== /etc/wsl.conf"; cat /etc/wsl.conf 2>/dev/null || echo "(não existe)"
echo; echo "== pasta do usuário do Windows vista do Linux"; wslpath -u "$WIN_HOME" 2>&1
`

async function probeWsl(distro: string, account: string | undefined): Promise<string> {
  if (!IS_WIN) return 'O WSL só existe no Windows.'
  const info = await ensureDistro(distro)
  if (!info) return `A distro ${distro} não respondeu (wsl.exe -d ${distro}).`
  const id = resolveAccount(account)
  const vars: Record<string, string> = {
    CLAUDE_BIN: info.claude ?? '',
    ACCOUNTS_ROOT: wslAccountsRoot(info),
    ACCOUNT_DIR: wslAccountDir(info, id) ?? '',
    LOGIN_DIR: wslLoginDir(distro, info, id) ?? '',
    WIN_HOME: homedir()
  }
  const script = `${Object.entries(vars)
    .map(([k, v]) => `${k}=${sq(v)}`)
    .join('\n')}\n${PROBE}`
  return new Promise((resolve) => {
    const child = spawn(WSL_EXE, ['-d', distro, '--exec', 'sh', '-s'], { windowsHide: true })
    let out = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => (out += d.toString('utf8').replace(/\0/g, '')))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve(`wsl.exe não abriu: ${e.message}`)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(`Conta ${id} na distro ${distro} (saiu com ${code})\n${out}`)
    })
    child.stdin.end(script)
  })
}

export function reportTools(diagnostics: () => Promise<string>) {
  return [
    tool(
      'diagnostico_app',
      'O que o Argus sabe agora: versões, contas e login de cada uma (conferido no lugar onde roda o Claude do app), pastas, distros do WSL, o registro do que o app pediu ao WSL e os avisos e erros recentes do app.',
      {},
      async () => text(await diagnostics())
    ),
    tool(
      'status_login',
      'Roda `claude auth status --json` com a conta, no mesmo lugar e com as mesmas variáveis que a conversa e o terminal de uma pasta usariam. Sem pasta nem distro: onde roda o Claude do app. Mostra se aquela conta está logada ali.',
      {
        conta: z.string().optional().describe('id da conta ("main" é a principal); sem ela, a padrão'),
        pasta: z.string().optional().describe('pasta do projeto como o app guarda: C:\\... no Windows, \\\\wsl.localhost\\<distro>\\home\\... no WSL'),
        distro: z.string().optional().describe('distro do WSL: roda lá, na pasta do usuário (use no lugar de pasta)')
      },
      async ({ conta, pasta, distro }) => {
        const cwd = pasta || (distro ? (await ensureDistro(distro), homeUnc(distro) ?? undefined) : undefined)
        return text(await loginStatus(conta, cwd))
      }
    ),
    tool(
      'conferir_wsl',
      'Confere dentro de uma distro do WSL, só lendo: versão do claude, pastas das contas, ~/.claude, quais arquivos de login existem (sem ler o conteúdo), os discos do Windows montados, /etc/wsl.conf e como o Linux enxerga a pasta do usuário do Windows. Também mostra as pastas que o app passa ao claude daquela conta.',
      {
        distro: z.string().describe('nome da distro, como aparece em diagnostico_app'),
        conta: z.string().optional().describe('id da conta ("main" é a principal); sem ela, a padrão')
      },
      async ({ distro, conta }) => text(await probeWsl(distro, conta))
    )
  ]
}
