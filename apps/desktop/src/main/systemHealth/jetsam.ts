import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

// O macOS diz por que matou um processo por memória: a cada morte assim ele grava um relatório
// (DiagnosticReports/JetsamEvent-<data>.ips) com todos os processos da hora e, no que morreu, o
// motivo. Conferido em 2026-10-30 num relatório de verdade: legível pela conta do usuário (o
// arquivo é do grupo _analyticsusers, em que os administradores estão).

const DIRS = ['/Library/Logs/DiagnosticReports', join(homedir(), 'Library/Logs/DiagnosticReports')]
const REPORT = /^JetsamEvent-.*\.ips$/
// O relatório sai um pouco depois da morte (quanto, não deu para medir): procura por este tempo.
const WAIT_MS = 30_000
const POLL_MS = 2_000
// Relógios e gravação podem atrasar: um relatório um pouco anterior à queda ainda vale.
const EARLY_MS = 10_000

// Motivos de jetsam (nomes do memorystatus do kernel). O processo passou do limite dele: fechar
// outros programas não adianta.
const PROCESS_LIMIT = new Set(['highwater', 'per-process-limit', 'conclave-limit'])
// Faltou memória no computador (páginas, compressor, swap, pressão contínua).
const SYSTEM_MEMORY = new Set([
  'jettisoned',
  'vm-pageshortage',
  'proc-thrashing',
  'fc-thrashing',
  'disk-space-shortage',
  'zone-map-exhaustion',
  'vm-compressor-thrashing',
  'vm-compressor-space-shortage',
  'low-swap',
  'sustained-memory-pressure',
  'vm-pageout-starvation'
])

export type JetsamCause = 'memory' | 'processLimit'

// O motivo gravado no relatório para esse pid; nulo se ele não morreu nesse relatório. A primeira
// linha é o cabeçalho; o resto, o relatório.
export function killReasonIn(text: string, pid: number): string | null {
  const body = text.slice(text.indexOf('\n') + 1)
  let report: { processes?: { pid?: unknown; reason?: unknown }[] }
  try {
    report = JSON.parse(body) as typeof report
  } catch {
    return null
  }
  const hit = report.processes?.find((p) => p.pid === pid && typeof p.reason === 'string')
  return typeof hit?.reason === 'string' ? hit.reason : null
}

// Nulo: motivo que não é de memória (o processo ocioso encerrado, falta de vnodes).
export function jetsamCause(reason: string): JetsamCause | null {
  if (PROCESS_LIMIT.has(reason)) return 'processLimit'
  if (SYSTEM_MEMORY.has(reason)) return 'memory'
  return null
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// O macOS matou esse pid por memória? Espera o relatório de depois de `since` aparecer; nulo se não
// aparecer nenhum com ele (encerrado por outro motivo ou por outro programa).
export async function jetsamKill(pid: number, since: number): Promise<JetsamCause | null> {
  const read = new Set<string>()
  for (let waited = 0; waited <= WAIT_MS; waited += POLL_MS) {
    for (const dir of DIRS) {
      const names = await readdir(dir).catch(() => [] as string[])
      for (const name of names) {
        const file = join(dir, name)
        if (!REPORT.test(name) || read.has(file)) continue
        const info = await stat(file).catch(() => null)
        if (!info || info.mtimeMs < since - EARLY_MS) continue
        read.add(file)
        const reason = killReasonIn(await readFile(file, 'utf8').catch(() => ''), pid)
        if (reason) return jetsamCause(reason)
      }
    }
    await wait(POLL_MS)
  }
  return null
}
