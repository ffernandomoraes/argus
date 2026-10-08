import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { childEnv, IS_WIN, prependPath, SYSTEM32 } from './platform'

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
export function runClaudeInstaller(): Promise<string | null> {
  const env = childEnv()
  prependPath(env, [])
  const [file, args] = IS_WIN
    ? [
        join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ${INSTALL_COMMAND}`
        ]
      ]
    : ['/bin/bash', ['-c', INSTALL_COMMAND]]
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
