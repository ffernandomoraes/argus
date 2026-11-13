import { powershell } from './powershell'
import type { ProcessTable } from './processTree'

// Uma linha por processo: pid, pai, nome, quando abriu e a linha de comando (vazia nos processos de
// outros usuários e do sistema).
const TABLE_SCRIPT = `Get-CimInstance Win32_Process | ForEach-Object {
  $created = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }
  "$($_.ProcessId)\`t$($_.ParentProcessId)\`t$($_.Name)\`t$created\`t$($_.CommandLine)"
}`

export function parseTable(text: string): ProcessTable {
  const table: ProcessTable = new Map()
  for (const line of text.split(/\r?\n/)) {
    const [pid, ppid, name, created, ...command] = line.split('\t')
    if (!pid || !/^\d+$/.test(pid)) continue
    table.set(Number(pid), { pid: Number(pid), ppid: Number(ppid), name: name ?? '', created: Number(created) || 0, command: command.join('\t') })
  }
  return table
}

let cached: { at: number; table: ProcessTable } | null = null
let pending: Promise<ProcessTable> | null = null

// A tabela leva uns 300 ms para sair. Vale a guardada enquanto for recente e tiver os processos
// pedidos; perguntas simultâneas esperam a mesma leitura.
export function processTable(maxAgeMs: number, mustHave: number[] = []): Promise<ProcessTable> {
  const hit = cached
  if (hit && Date.now() - hit.at < maxAgeMs && mustHave.every((pid) => hit.table.has(pid))) return Promise.resolve(hit.table)
  pending ??= powershell(TABLE_SCRIPT)
    .then((text) => {
      const table = parseTable(text)
      cached = { at: Date.now(), table }
      return table
    })
    .finally(() => (pending = null))
  return pending
}
