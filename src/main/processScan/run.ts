import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Caminhos absolutos: aberto pelo Dock, o app não herda o PATH do terminal.
export const LSOF = '/usr/sbin/lsof'
export const PS = '/bin/ps'

// lsof sai com erro quando não acha nada; a saída parcial ainda serve.
export async function output(file: string, args: string[]): Promise<string> {
  try {
    return (await run(file, args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024 })).stdout
  } catch (err) {
    return (err as { stdout?: string }).stdout ?? ''
  }
}
