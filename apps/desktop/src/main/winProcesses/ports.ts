import { execFile } from 'node:child_process'
import { HIDDEN, NETSTAT } from './system'

// Saída do `netstat -ano` → portas abertas para conexão, por processo (IPv4 e IPv6). A coluna do
// estado vem traduzida conforme o idioma do Windows ("LISTENING", "ABHÖREN"...); quem está
// escutando é reconhecido pelo endereço remoto zerado, que não muda com o idioma.
export function parseNetstat(text: string): Map<number, number[]> {
  const ports = new Map<number, number[]>()
  for (const line of text.split(/\r?\n/)) {
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
  return ports
}

// Pelo netstat, que responde rápido.
export function listeningPorts(): Promise<Map<number, number[]>> {
  return new Promise((resolve) =>
    execFile(NETSTAT, ['-ano'], { ...HIDDEN, timeout: 10_000, encoding: 'utf8' }, (_err, stdout) =>
      resolve(parseNetstat(String(stdout ?? '')))
    )
  )
}
