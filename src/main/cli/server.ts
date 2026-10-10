import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { isDirectory } from '../paths'
import { IS_WIN } from '../platform'
import { CLI_BIN, SCRIPT, SOCKET } from './locations'
import { macScript, windowsScript } from './scripts'

// O corpo do pedido é só o caminho de uma pasta: mais que isso não veio do script do argus.
const MAX_BODY = 4096

// Grava o script do `argus` e, no Mac, escuta o socket por onde ele manda a pasta. No Windows, o
// argus.cmd abre o Argus.exe com a pasta, e o app já aberto recebe dele o pedido (ver openArg.ts).
export class Cli {
  private server: Server | null = null

  constructor(private onOpen: (path: string) => void) {}

  start(): void {
    mkdirSync(CLI_BIN, { recursive: true })
    if (IS_WIN) {
      writeFileSync(SCRIPT, windowsScript())
      return
    }
    writeFileSync(SCRIPT, macScript(), { mode: 0o755 })
    // Socket que sobrou de um app que fechou sem limpar: sem apagar, o listen falha.
    try {
      unlinkSync(SOCKET)
    } catch {
      // não havia
    }
    this.server = createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/open') {
        res.statusCode = 404
        return void res.end()
      }
      let body = ''
      let tooBig = false
      req.setEncoding('utf8')
      req.on('error', () => undefined)
      req.on('data', (chunk: string) => {
        if (tooBig) return
        body += chunk
        if (body.length <= MAX_BODY) return
        tooBig = true
        res.statusCode = 413
        res.end()
        req.destroy()
      })
      req.on('end', () => {
        if (tooBig) return
        const path = body.trim()
        // A pasta pode sumir entre o script mandar e o app conferir: o isDirectory não lança.
        const ok = path.startsWith('/') && isDirectory(path)
        if (ok) this.onOpen(path)
        res.statusCode = ok ? 200 : 400
        res.end()
      })
    })
    this.server.on('error', (err) => console.error('argus:', err.message))
    this.server.listen(SOCKET)
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }
}
