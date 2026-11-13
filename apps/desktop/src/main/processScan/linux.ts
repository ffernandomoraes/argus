import { readdir, readFile, readlink } from 'node:fs/promises'
import { mapLimit } from '../transcripts/mapLimit'
import { ancestorPids, claudeOwned } from './family'
import { listeningSockets, nulList, parseStat, socketInode } from './linuxParse'
import type { PsTree } from './macParse'
import { sessionIdIn } from './marks'
import { ownPgid } from './ownGroup'
import type { Listening } from './types'

// Linux: tudo vem do /proc, sem programas externos (o lsof nem sempre está instalado). As portas
// que escutam saem do /proc/net/tcp; o dono de cada uma, dos descritores abertos de cada processo
// (o link "socket:[inode]"); a pasta, o comando, o ambiente, o pai e o grupo, dos arquivos do
// processo. Só aparecem os processos do próprio usuário, como no Mac.

const PARALLEL = 32
const text = (path: string) => readFile(path, 'utf8').catch(() => '')

export async function scanLinux(): Promise<Listening[]> {
  const uid = process.getuid?.() ?? -1
  const sockets = new Map<number, number[]>()
  for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
    for (const [inode, ports] of listeningSockets(await text(file), uid)) sockets.set(inode, ports)
  }
  if (!sockets.size) return []

  const pids = (await readdir('/proc').catch(() => [] as string[])).filter((n) => /^\d+$/.test(n)).map(Number)
  const tree: PsTree = new Map()
  const owners = new Map<number, number[]>()
  await mapLimit(pids, PARALLEL, async (pid) => {
    const stat = parseStat(await text(`/proc/${pid}/stat`))
    if (!stat) return
    tree.set(pid, { ...stat, command: nulList(await text(`/proc/${pid}/cmdline`)) })
    // Os descritores de processos de outro usuário não abrem: ficam de fora.
    const fds = await readdir(`/proc/${pid}/fd`).catch(() => [] as string[])
    const ports = new Set<number>()
    for (const fd of fds) {
      const inode = socketInode(await readlink(`/proc/${pid}/fd/${fd}`).catch(() => ''))
      for (const port of (inode && sockets.get(inode)) || []) ports.add(port)
    }
    if (ports.size) owners.set(pid, [...ports].sort((a, b) => a - b))
  })

  const own = await ownPgid()
  // No pnpm dev, o servidor deste app é um dos processos acima dele.
  const above = ancestorPids(tree, process.pid)
  const found: Listening[] = []
  for (const [pid, ports] of owners) {
    const info = tree.get(pid)
    if (!info) continue
    const [env, cwd] = await Promise.all([text(`/proc/${pid}/environ`).then(nulList), readlink(`/proc/${pid}/cwd`).catch(() => '')])
    const current = above.has(pid)
    // No grupo do Argus, fora os processos acima dele, só há o que as conversas do SDK abriram.
    const claude = claudeOwned(tree, pid) || (!!own && info.pgid === own && !current)
    found.push({
      pid,
      pgid: info.pgid,
      ports,
      cwd,
      command: info.command,
      sessionId: sessionIdIn(env),
      current: current || undefined,
      locked: claude ? 'claude' : undefined,
      claude,
      env
    })
  }
  return found
}
