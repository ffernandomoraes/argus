// Leitura dos arquivos do /proc (Linux). Lógica pura.

// /proc/net/tcp e tcp6: uma linha por conexão. Ficam as que escutam (estado 0A) e são do usuário:
// inode do socket → portas.
export function listeningSockets(text: string, uid: number): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/)
    if (f.length < 10 || f[3] !== '0A' || Number(f[7]) !== uid) continue
    const port = parseInt(f[1].slice(f[1].lastIndexOf(':') + 1), 16)
    const inode = Number(f[9])
    if (!port || !inode) continue
    const ports = out.get(inode) ?? []
    if (!ports.includes(port)) ports.push(port)
    out.set(inode, ports)
  }
  return out
}

// /proc/<pid>/stat: "pid (comando) estado ppid pgrp ...". O nome entre parênteses pode ter espaço e
// parêntese: o resto começa depois do último ")".
export function parseStat(text: string): { ppid: number; pgid: number } | null {
  const close = text.lastIndexOf(')')
  if (close < 0) return null
  const f = text.slice(close + 2).split(' ')
  const ppid = Number(f[1])
  const pgid = Number(f[2])
  return Number.isInteger(ppid) && Number.isInteger(pgid) ? { ppid, pgid } : null
}

// cmdline e environ separam os itens com \0; viram uma linha, como o ps mostra.
export const nulList = (text: string): string => text.split('\0').filter(Boolean).join(' ')

// Destino do link de um descritor ("socket:[12345]") → inode do socket.
export function socketInode(link: string): number | null {
  const m = /^socket:\[(\d+)\]$/.exec(link)
  return m ? Number(m[1]) : null
}
