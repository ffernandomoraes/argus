import { execFile } from 'node:child_process'
import { release } from 'node:os'
import { app } from 'electron'
import { claudePath, nativeClaudeFound } from '../claudePath'
import { IS_WIN } from '../platform'
import { distroFor } from './index'
import { distroInfo, listDistros, loadDistro, WSL_EXE } from './distros'
import { logLines } from './log'

// Texto para a pessoa copiar e mandar quando algo do WSL não funciona: versões, distros, o que o
// app achou em cada uma e o registro do que pediu ao WSL (ver log.ts).

function wslVersion(): Promise<string> {
  return new Promise((resolve) => {
    execFile(WSL_EXE, ['--version'], { encoding: 'buffer', timeout: 10_000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(`(sem resposta: ${err.message})`)
      const utf16 = stdout.length > 1 && stdout[1] === 0
      resolve((utf16 ? stdout.toString('utf16le') : stdout.toString('utf8')).replace(/\0/g, '').trim())
    })
  })
}

export async function wslDiagnostics(): Promise<string> {
  if (!IS_WIN) return 'O WSL só existe no Windows.'
  const distros = await listDistros()
  await Promise.all(distros.map((d) => loadDistro(d)))
  const lines = [
    `Argus ${app.getVersion()} - Windows ${release()}`,
    `Claude Code do Windows: ${nativeClaudeFound() ? claudePath() : 'não instalado'}`,
    `Claude do app roda em: ${distroFor() ? `WSL (${distroFor()})` : 'Windows'}`,
    '',
    '== wsl --version',
    await wslVersion(),
    '',
    '== Distros',
    ...(distros.length ? distros : ['(nenhuma)']).map((d) => {
      const info = distroInfo(d)
      return info ? `${d}: home=${info.home} claude=${info.claude ?? 'não instalado'}\n  PATH=${info.path}` : `${d}: sem resposta`
    }),
    '',
    '== Registro',
    ...logLines()
  ]
  return lines.join('\n')
}
