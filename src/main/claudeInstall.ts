import { execFile, spawn } from 'node:child_process'
import { childEnv, IS_LINUX, IS_WIN, prependPath, WINDOWS_POWERSHELL } from './platform'

// Instalador oficial da Anthropic, o mesmo da documentação do Claude Code. Põe o `claude` em
// ~/.local/bin (claude.exe no Windows), o primeiro lugar onde o Argus procura.
export const INSTALL_COMMAND = IS_WIN
  ? 'irm https://claude.ai/install.ps1 | iex'
  : 'curl -fsSL https://claude.ai/install.sh | bash'

// Baixar e instalar leva de segundos a alguns minutos, conforme a internet.
const TIMEOUT_MS = 10 * 60_000

// Roda o instalador sem janela. Devolve nulo se terminou bem, senão o fim da saída (o erro).
// Windows: TLS 1.2 garantido (o PowerShell 5.1 de sistemas antigos tenta versões que o site
// recusa) e saída em UTF-8, para a mensagem de erro chegar com acento.
// Mac: com pipefail, o curl falhando (sem internet) sai com erro; sem ele, o bash recebia o
// script vazio, saía com 0 e a falha só aparecia como "o Claude Code não apareceu".
export function runClaudeInstaller(): Promise<string | null> {
  if (IS_LINUX) return runLinuxInstaller()
  const env = childEnv()
  prependPath(env, [])
  const [file, args] = IS_WIN
    ? [
        WINDOWS_POWERSHELL,
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ${INSTALL_COMMAND}`
        ]
      ]
    : ['/bin/bash', ['-c', `set -o pipefail; ${INSTALL_COMMAND}`]]
  return new Promise((resolve) =>
    execFile(
      file,
      args,
      { env, timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (!err) return resolve(null)
        if (err.killed) return resolve('A instalação passou de 10 minutos e foi interrompida.')
        const tail = `${stderr}\n${stdout}`
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(-6)
          .join('\n')
        resolve(tail || err.message)
      }
    )
  )
}

// Últimas linhas da saída de um instalador que falhou: o que a tela mostra.
const tailOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join('\n')

// Linux: o Ubuntu recém-instalado nem sempre tem o curl. O script vem pelo próprio app e entra no
// bash pela entrada padrão, como o `curl ... | bash` faria. Ele mesmo baixa o Claude Code (pelo curl
// ou pelo wget, o que houver).
async function runLinuxInstaller(): Promise<string | null> {
  let script: string
  try {
    const res = await fetch('https://claude.ai/install.sh', { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) return `Não deu para baixar o instalador (HTTP ${res.status}).`
    script = await res.text()
  } catch (err) {
    return `Não deu para baixar o instalador: ${(err as Error).message}`
  }
  const env = childEnv()
  prependPath(env, [])
  return new Promise((resolve) => {
    const child = spawn('/bin/bash', ['-s'], { env, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    const keep = (d: Buffer) => {
      out = (out + d.toString('utf8')).slice(-16_000)
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve(err.message)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) return resolve(null)
      resolve(signal ? 'A instalação passou de 10 minutos e foi interrompida.' : tailOf(out) || `O instalador saiu com o código ${code}.`)
    })
    child.stdin.end(script)
  })
}
