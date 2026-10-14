import { execFile } from 'node:child_process'
import { mkdirSync, renameSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderId } from '../../shared/providers'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { childEnv, IS_WIN, prependPath, WINDOWS_POWERSHELL } from '../platform'
import { toolsDir } from './paths'

// Instaladores oficiais, os mesmos da documentação de cada um. O Gemini só existe pelo npm (exige
// Node 20+): o Argus baixa o pacote do registro do npm e roda pelo Node do Electron (ver bins.ts),
// para a pessoa não precisar instalar Node.
export const INSTALL_COMMANDS: Record<ProviderId, string> = {
  codex: IS_WIN ? 'irm https://chatgpt.com/codex/install.ps1 | iex' : 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
  cursor: IS_WIN ? "irm 'https://cursor.com/install?win32=true' | iex" : 'curl https://cursor.com/install -fsS | bash',
  gemini: 'npm install -g @google/gemini-cli'
}

const TIMEOUT_MS = 10 * 60_000

const tailOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join('\n')

// Devolve nulo se terminou bem; senão, o motivo.
export function runInstaller(provider: ProviderId): Promise<string | null> {
  return provider === 'gemini' ? installGemini() : runScript(INSTALL_COMMANDS[provider])
}

// Mesmo jeito do instalador do Claude (claudeInstall.ts): sem janela, pipefail no bash, TLS 1.2 e
// UTF-8 no PowerShell.
function runScript(command: string): Promise<string | null> {
  const env = childEnv()
  prependPath(env, [])
  const [file, args] = IS_WIN
    ? [
        WINDOWS_POWERSHELL,
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ${command}`
        ]
      ]
    : ['/bin/bash', ['-c', `set -o pipefail; ${command}`]]
  return new Promise((resolve) =>
    execFile(file, args, { env, timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (!err) return resolve(null)
      if (err.killed) return resolve(tr('A instalação passou de 10 minutos e foi interrompida.', 'The installation took more than 10 minutes and was stopped.'))
      resolve(tailOf(`${stderr}\n${stdout}`) || err.message)
    })
  )
}

// Gemini: a versão mais nova do registro do npm, extraída em tools/gemini/<versão>. O pacote é
// autocontido (bundle/); as dependências nativas dele são opcionais.
async function installGemini(): Promise<string | null> {
  try {
    const meta = await fetch('https://registry.npmjs.org/@google/gemini-cli/latest', { signal: AbortSignal.timeout(30_000) })
    if (!meta.ok) return tr(`Não deu para consultar o npm (HTTP ${meta.status}).`, `Couldn’t reach npm (HTTP ${meta.status}).`)
    const { version, dist } = (await meta.json()) as { version: string; dist: { tarball: string } }
    const tgz = await fetch(dist.tarball, { signal: AbortSignal.timeout(5 * 60_000) })
    if (!tgz.ok) return tr(`Não deu para baixar o Gemini (HTTP ${tgz.status}).`, `Couldn’t download Gemini (HTTP ${tgz.status}).`)
    const root = join(toolsDir(), 'gemini')
    const staging = join(root, `.staging-${version}`)
    rmSync(staging, { recursive: true, force: true })
    mkdirSync(staging, { recursive: true })
    const file = join(staging, 'gemini.tgz')
    await writeFile(file, Buffer.from(await tgz.arrayBuffer()))
    // tar existe no Mac, no Linux e no Windows 10+ (System32\tar.exe).
    const tar = IS_WIN ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    const failed = await new Promise<string | null>((resolve) =>
      execFile(tar, ['-xzf', file, '-C', staging], { windowsHide: true }, (err, _o, stderr) => resolve(err ? tailOf(stderr) || err.message : null))
    )
    if (failed) return failed
    rmSync(file, { force: true })
    const dest = join(root, version)
    rmSync(dest, { recursive: true, force: true })
    renameSync(staging, dest)
    return null
  } catch (err) {
    return tr(`Não deu para instalar o Gemini: ${errorMessage(err)}`, `Couldn’t install Gemini: ${errorMessage(err)}`)
  }
}
