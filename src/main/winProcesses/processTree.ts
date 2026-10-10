// Família de um processo na tabela do Windows (ver processTable.ts). Lógica pura.

export type WinProcess = { pid: number; ppid: number; name: string; command: string; created: number }

export type ProcessTable = Map<number, WinProcess>

// Do processo até o mais antigo da família. Um número de processo pode ser reaproveitado pelo
// Windows depois que o dono sai: pai que abriu depois do filho não é o pai de verdade.
export function ancestors(table: ProcessTable, pid: number): WinProcess[] {
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

function descendsFrom(table: ProcessTable, pid: number, root: number): boolean {
  return pid === root || ancestors(table, pid).some((p) => p.pid === root)
}

// Processos abertos por este, enquanto rodam.
export function childrenOf(table: ProcessTable, pid: number): WinProcess[] {
  const parent = table.get(pid)
  return [...table.values()].filter((p) => p.ppid === pid && p.pid !== pid && (!parent || p.created >= parent.created))
}
