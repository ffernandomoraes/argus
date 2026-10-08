import { execFile, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { SYSTEM32 } from './platform'

// Processos no Windows, no lugar do `ps`, do `lsof` e dos grupos de processo do Mac. Só é usado
// quando o app roda no Windows.

const POWERSHELL = join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const NETSTAT = join(SYSTEM32, 'NETSTAT.EXE')
const TASKKILL = join(SYSTEM32, 'taskkill.exe')

// windowsHide em toda chamada: sem ele, cada programa de linha de comando aberto pelo app pisca uma
// janela preta na tela.
const HIDDEN = { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }

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

export type WinProcess = { pid: number; ppid: number; name: string; command: string; created: number }

// Uma linha por processo: pid, pai, nome, quando abriu e a linha de comando (vazia nos processos de
// outros usuários e do sistema).
const TABLE_SCRIPT = `Get-CimInstance Win32_Process | ForEach-Object {
  $created = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }
  "$($_.ProcessId)\`t$($_.ParentProcessId)\`t$($_.Name)\`t$created\`t$($_.CommandLine)"
}`

function parseTable(text: string): Map<number, WinProcess> {
  const table = new Map<number, WinProcess>()
  for (const line of text.split(/\r?\n/)) {
    const [pid, ppid, name, created, ...command] = line.split('\t')
    if (!pid || !/^\d+$/.test(pid)) continue
    table.set(Number(pid), { pid: Number(pid), ppid: Number(ppid), name: name ?? '', created: Number(created) || 0, command: command.join('\t') })
  }
  return table
}

let cached: { at: number; table: Map<number, WinProcess> } | null = null
let pending: Promise<Map<number, WinProcess>> | null = null

// A tabela leva uns 300 ms para sair. Vale a guardada enquanto for recente e tiver os processos
// pedidos; perguntas simultâneas esperam a mesma leitura.
export function processTable(maxAgeMs: number, mustHave: number[] = []): Promise<Map<number, WinProcess>> {
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

// Do processo até o mais antigo da família. Um número de processo pode ser reaproveitado pelo
// Windows depois que o dono sai: pai que abriu depois do filho não é o pai de verdade.
export function ancestors(table: Map<number, WinProcess>, pid: number): WinProcess[] {
  const out: WinProcess[] = []
  let current = table.get(pid)
  const seen = new Set<number>()
  while (current && !seen.has(current.pid) && out.length < 64) {
    seen.add(current.pid)
    const parent = table.get(current.ppid)
    if (!parent || parent.pid === current.pid || (parent.created && current.created && parent.created > current.created)) break
    out.push(parent)
    current = parent
  }
  return out
}

export function descendsFrom(table: Map<number, WinProcess>, pid: number, root: number): boolean {
  return pid === root || ancestors(table, pid).some((p) => p.pid === root)
}

// Processos abertos por este, enquanto rodam.
export function childrenOf(table: Map<number, WinProcess>, pid: number): WinProcess[] {
  const parent = table.get(pid)
  return [...table.values()].filter((p) => p.ppid === pid && p.pid !== pid && (!parent || p.created >= parent.created))
}

// Portas TCP abertas para conexão, por processo (IPv4 e IPv6). Pelo netstat, que responde rápido.
// A coluna do estado vem traduzida conforme o idioma do Windows ("LISTENING", "ABHÖREN"...); quem
// está escutando é reconhecido pelo endereço remoto zerado, que não muda com o idioma.
export function listeningPorts(): Promise<Map<number, number[]>> {
  return new Promise((resolve) =>
    execFile(NETSTAT, ['-ano'], { ...HIDDEN, timeout: 10_000, encoding: 'utf8' }, (_err, stdout) => {
      const ports = new Map<number, number[]>()
      for (const line of String(stdout ?? '').split(/\r?\n/)) {
        const m = /^\s*TCP\s+(\S+)\s+(\S+)\s+\S+\s+(\d+)\s*$/i.exec(line)
        if (!m || !/^(0\.0\.0\.0|\[::\]):0$/.test(m[2])) continue
        const pid = Number(m[3])
        const port = Number(m[1].slice(m[1].lastIndexOf(':') + 1))
        // 0 e 4 são o próprio sistema.
        if (pid <= 4 || !port) continue
        const list = ports.get(pid) ?? []
        if (!list.includes(port)) list.push(port)
        ports.set(pid, list)
      }
      resolve(ports)
    })
  )
}

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
