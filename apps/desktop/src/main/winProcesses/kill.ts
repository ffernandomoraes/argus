import { execFile, execFileSync } from 'node:child_process'
import { HIDDEN, TASKKILL } from './system'

// Encerra o processo e tudo que ele abriu (o equivalente de mandar o sinal para o grupo no Mac).
export function killTree(pid: number): Promise<boolean> {
  return new Promise((resolve) =>
    execFile(TASKKILL, ['/PID', String(pid), '/T', '/F'], { ...HIDDEN, timeout: 10_000 }, (err) => resolve(!err))
  )
}

// Para o fechamento do app, que não espera nada assíncrono.
export function killTreeSync(pid: number): void {
  try {
    execFileSync(TASKKILL, ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000, stdio: 'ignore' })
  } catch {
    // Já saiu.
  }
}
