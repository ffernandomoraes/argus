import { execFile } from 'node:child_process'
import { HIDDEN, POWERSHELL } from './system'

// Roda um script fixo no PowerShell do sistema e devolve a saída. O script vai codificado, para
// as aspas dele não brigarem com as da linha de comando. Dados (caminhos de arquivo) nunca entram no
// texto do script: vão em variáveis de ambiente (vars), lidas lá dentro como $env:NOME. Assim um
// nome de arquivo com aspas não vira comando. A saída sai em UTF-8, senão nomes com acento
// ("Área de Trabalho") chegam trocados.
export function powershell(script: string, vars: Record<string, string> = {}, timeout = 15_000): Promise<string> {
  const full = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n${script}`
  const encoded = Buffer.from(full, 'utf16le').toString('base64')
  return new Promise((resolve) =>
    execFile(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { ...HIDDEN, timeout, encoding: 'utf8', env: { ...process.env, ...vars } },
      (_err, stdout) => resolve(String(stdout ?? ''))
    )
  )
}
