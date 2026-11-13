// Leitura das saídas do lsof e do ps (Mac). Lógica pura.

// Saída `-F` do lsof: uma linha `p<pid>` abre cada processo, seguida das linhas de campo.
export function parseFields(text: string, field: string): Map<number, string[]> {
  const out = new Map<number, string[]>()
  let pid = 0
  for (const line of text.split('\n')) {
    if (line[0] === 'p') {
      pid = Number(line.slice(1))
      if (!out.has(pid)) out.set(pid, [])
    } else if (line[0] === field && pid) out.get(pid)!.push(line.slice(1))
  }
  return out
}

// `ps -o pid=,pgid=,command=`: os dois números e o resto da linha.
export function parsePs(text: string): Map<number, { pgid: number; rest: string }> {
  const out = new Map<number, { pgid: number; rest: string }>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s(.*)$/)
    if (m) out.set(Number(m[1]), { pgid: Number(m[2]), rest: m[3].trim() })
  }
  return out
}

export type PsTree = Map<number, { ppid: number; pgid: number; command: string }>

// `ps -ax -o pid=,ppid=,pgid=,args=`: todos os processos, com pai, grupo e linha de comando.
export function parsePsTree(text: string): PsTree {
  const tree: PsTree = new Map()
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)
    if (m) tree.set(Number(m[1]), { ppid: Number(m[2]), pgid: Number(m[3]), command: m[4].trim() })
  }
  return tree
}

// Endereços do lsof ("*:5173", "[::1]:5173") → portas, sem repetir: IPv4 e IPv6 da mesma porta
// viram uma linha só.
export function uniquePorts(addresses: string[]): number[] {
  const unique = new Set(addresses.map((addr) => Number(addr.slice(addr.lastIndexOf(':') + 1))))
  return [...unique].filter(Boolean).sort((a, b) => a - b)
}
