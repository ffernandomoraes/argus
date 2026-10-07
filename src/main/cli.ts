import { execFile } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readlinkSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import type { CliStatus } from '../shared/cli'

// Comando `cae`, o `code .` deste app: em qualquer terminal, `cae .` abre a pasta no canvas.
// O script manda o caminho por um socket local; o app escuta enquanto está aberto.
const DIR = join(homedir(), '.cae')
export const CLI_BIN = join(DIR, 'bin')
const SCRIPT = join(CLI_BIN, 'cae')
const SOCKET = join(DIR, 'app.sock')
// Já está no PATH de quem usa o instalador do Claude Code; não pede senha de administrador.
const LINK = join(homedir(), '.local', 'bin', 'cae')

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

function script(): string {
  // Empacotado, o comando abre o app se ele estiver fechado. Em desenvolvimento não há .app para abrir.
  const bundle = app.isPackaged ? process.execPath.replace(/\.app\/.*$/, '.app') : null
  const launch = bundle
    ? `open -a ${quote(bundle)} && for _ in $(seq 1 50); do sleep 0.2; send && exit 0; done\n`
    : ''
  return `#!/bin/sh
# Gerado pelo canva-agent-editor a cada vez que o app abre; mudanças aqui se perdem.
target="\${1:-.}"
dir=$(cd "$target" 2>/dev/null && pwd -P) || { echo "cae: pasta não encontrada: $target" >&2; exit 1; }
send() { curl -sf --unix-socket ${quote(SOCKET)} --data-binary "$dir" http://cae/open >/dev/null 2>&1; }
send && exit 0
${launch}echo "cae: o app não está aberto." >&2
exit 1
`
}

export class Cli {
  private server: Server | null = null

  constructor(private onOpen: (path: string) => void) {}

  start(): void {
    mkdirSync(CLI_BIN, { recursive: true })
    writeFileSync(SCRIPT, script(), { mode: 0o755 })
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
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => (body += chunk))
      req.on('end', () => {
        const path = body.trim()
        const ok = path.startsWith('/') && existsSync(path) && statSync(path).isDirectory()
        if (ok) this.onOpen(path)
        res.statusCode = ok ? 200 : 400
        res.end()
      })
    })
    this.server.on('error', (err) => console.error('cae:', err.message))
    this.server.listen(SOCKET)
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }
}

function linkTarget(): string | null {
  try {
    return lstatSync(LINK).isSymbolicLink() ? readlinkSync(LINK) : 'outro'
  } catch {
    return null
  }
}

// PATH do shell de login da pessoa, para avisar se ~/.local/bin não está nele.
function loginPath(): Promise<string> {
  return new Promise((resolve) => {
    execFile(process.env.SHELL || '/bin/zsh', ['-ilc', 'echo "$PATH"'], { timeout: 5000 }, (_err, stdout) =>
      resolve(stdout.trim().split('\n').pop() ?? '')
    )
  })
}

export async function cliStatus(): Promise<CliStatus> {
  const target = linkTarget()
  if (target === null) return { installed: false }
  if (target !== SCRIPT) return { installed: false, error: `Já existe outro comando em ${LINK.replace(homedir(), '~')}.` }
  const dir = dirname(LINK)
  const inPath = (await loginPath()).split(':').includes(dir)
  return { installed: true, ...(!inPath && { warning: `Adicione ~/.local/bin ao PATH do seu shell para o comando funcionar.` }) }
}

export async function installCli(): Promise<CliStatus> {
  const target = linkTarget()
  if (target === null) {
    mkdirSync(dirname(LINK), { recursive: true })
    symlinkSync(SCRIPT, LINK)
  }
  return cliStatus()
}

export async function uninstallCli(): Promise<CliStatus> {
  // Só remove o link que é deste app; um `cae` de outro programa fica onde está.
  if (linkTarget() === SCRIPT) unlinkSync(LINK)
  return cliStatus()
}
