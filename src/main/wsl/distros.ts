import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { readJsonFile, writeJsonAtomicSync } from '../lib/jsonFile'
import { IS_WIN, SYSTEM32 } from '../platform'
import { log } from './log'
import { sameDistro, setUncPrefix, toUnc } from './path'

// As distros do WSL instaladas e o que o app precisa de cada uma: a pasta do usuário, o PATH do
// shell de login (onde o nvm e o instalador do Claude põem os programas) e o `claude`. Perguntar ao
// Linux leva de meio a vários segundos (o primeiro wsl.exe liga a máquina virtual), então o
// resultado fica guardado em memória e num arquivo: quem precisa na hora (sem esperar) usa o da
// última vez, e a conferência roda em segundo plano.

export const WSL_EXE = join(SYSTEM32, 'wsl.exe')

export type DistroInfo = {
  home: string
  // PATH do shell de login, como o terminal do Linux teria.
  path: string
  // Caminho do `claude` no Linux; nulo se não está instalado nessa distro.
  claude: string | null
}

const cache = new Map<string, DistroInfo>()
const loading = new Map<string, Promise<DistroInfo | null>>()
let names: string[] = []
let listing: Promise<string[]> | null = null
let loaded = false

const file = () => join(app.getPath('userData'), 'wsl.json')

type Saved = { distros?: string[]; info?: Record<string, DistroInfo> }

function restore(): void {
  if (loaded) return
  loaded = true
  const r = readJsonFile<Saved>(file())
  if (r.status !== 'ok' || !r.data || typeof r.data !== 'object') return
  names = Array.isArray(r.data.distros) ? r.data.distros.filter((d) => typeof d === 'string') : []
  for (const [d, info] of Object.entries(r.data.info ?? {})) {
    if (info && typeof info.home === 'string' && typeof info.path === 'string') cache.set(d, info)
  }
}

function persist(): void {
  try {
    writeJsonAtomicSync(file(), { distros: names, info: Object.fromEntries(cache) })
  } catch {
    // Sem gravar, a próxima abertura pergunta de novo.
  }
}

// A saída do wsl.exe (as mensagens dele, não a dos programas do Linux) vem em UTF-16. Com
// WSL_UTF8=1 as versões novas mandam UTF-8; vale o que chegar.
function decode(buf: Buffer): string {
  const utf16 = buf.length > 1 && (buf[1] === 0 || (buf[0] === 0xff && buf[1] === 0xfe))
  return (utf16 ? buf.toString('utf16le') : buf.toString('utf8')).replace(/^﻿/, '').replace(/\0/g, '')
}

// Nomes das distros, como o `wsl -l -q` lista. Sem WSL (ou com erro), lista vazia.
export function listDistros(): Promise<string[]> {
  if (!IS_WIN) return Promise.resolve([])
  restore()
  listing ??= new Promise<string[]>((resolve) => {
    execFile(
      WSL_EXE,
      ['-l', '-q'],
      { encoding: 'buffer', timeout: 15_000, windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } },
      (err, stdout) => {
        if (err) log('wsl -l -q falhou', err.message)
        const found = err
          ? names
          : decode(stdout)
              .split(/\r?\n/)
              .map((l) => l.trim())
              // As do Docker Desktop são internas dele: não têm usuário nem projetos.
              .filter((l) => l && !/^docker-desktop/i.test(l))
        resolve(found)
      }
    )
  }).then((found) => {
    names = found
    persist()
    return found
  })
  void listing.finally(() => {
    listing = null
  })
  return listing
}

// Só as distros ligadas agora (`wsl -l --running -q`): perguntar não liga nenhuma. Nenhuma ligada,
// o wsl.exe sai com erro e a lista fica vazia.
export function runningDistros(): Promise<string[]> {
  if (!IS_WIN) return Promise.resolve([])
  return new Promise((resolve) => {
    execFile(
      WSL_EXE,
      ['-l', '--running', '-q'],
      { encoding: 'buffer', timeout: 15_000, windowsHide: true, env: { ...process.env, WSL_UTF8: '1' } },
      (err, stdout) =>
        resolve(
          err
            ? []
            : decode(stdout)
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l && !/^docker-desktop/i.test(l))
        )
    )
  })
}

// As distros da última vez que o app perguntou, sem esperar.
export function knownDistros(): string[] {
  if (!IS_WIN) return []
  restore()
  return names
}

// O que se sabe da distro, sem esperar. Nulo antes da primeira conferência.
export function distroInfo(distro: string): DistroInfo | null {
  if (!IS_WIN) return null
  restore()
  for (const [d, info] of cache) if (sameDistro(d, distro)) return info
  return null
}

// Roda pelo stdin do `sh`, e não como argumento: nada de aspas passando pelo wsl.exe. O shell de
// login da pessoa (bash, zsh, fish) carrega o PATH como o terminal dela; o `env` imprime do mesmo
// jeito em qualquer um deles. Pastas do Windows (/mnt/...) não contam na procura do `claude`: lá
// estaria o do Windows, que não roda no Linux.
const PROBE = `
s=$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f7)
[ -x "$s" ] || s=/bin/bash
p=$("$s" -lic env 2>/dev/null </dev/null | grep '^PATH=' | tail -n 1 | cut -c6-)
[ -n "$p" ] || p=$PATH
printf '__ARGUS_HOME__%s\\n' "$HOME"
printf '__ARGUS_PATH__%s\\n' "$p"
c=
for f in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude"; do [ -x "$f" ] && { c=$f; break; }; done
if [ -z "$c" ]; then
  IFS=:
  for d in $p; do
    case "$d" in /mnt/*|'') continue ;; esac
    [ -x "$d/claude" ] && { c=$d/claude; break; }
  done
fi
printf '__ARGUS_CLAUDE__%s\\n' "$c"
`

function field(out: string, mark: string): string {
  const line = out.split('\n').find((l) => l.startsWith(mark))
  return line ? line.slice(mark.length).trim() : ''
}

function probe(distro: string): Promise<DistroInfo | null> {
  return new Promise((resolve) => {
    const child = spawn(WSL_EXE, ['-d', distro, '--cd', '~', '--exec', 'sh', '-s'], { windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on('data', (d: Buffer) => (out += d.toString('utf8')))
    child.stderr.on('data', (d: Buffer) => (err += decode(d)))
    child.on('error', (e) => {
      clearTimeout(timer)
      log(`wsl -d ${distro}: não abriu`, e.message)
      resolve(null)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const home = field(out, '__ARGUS_HOME__')
      if (!home.startsWith('/')) {
        log(`wsl -d ${distro}: resposta sem a pasta do usuário (código ${code})`, err.slice(0, 500))
        return resolve(null)
      }
      resolve({ home, path: field(out, '__ARGUS_PATH__'), claude: field(out, '__ARGUS_CLAUDE__') || null })
    })
    child.stdin.end(PROBE)
  })
}

// Pergunta de novo ao Linux (e guarda). Duas chamadas ao mesmo tempo esperam a mesma resposta.
export function loadDistro(distro: string): Promise<DistroInfo | null> {
  if (!IS_WIN) return Promise.resolve(null)
  restore()
  const key = distro.toLowerCase()
  let p = loading.get(key)
  if (!p) {
    p = probe(distro).then((info) => {
      if (info) {
        for (const d of cache.keys()) if (sameDistro(d, distro)) cache.delete(d)
        cache.set(distro, info)
        // Windows 10 antigo só conhece o \\wsl$.
        if (!existsSync(`\\\\wsl.localhost\\${distro}\\`) && existsSync(`\\\\wsl$\\${distro}\\`)) setUncPrefix('\\\\wsl$')
        persist()
        log(`wsl -d ${distro}`, JSON.stringify({ home: info.home, claude: info.claude }))
      }
      return info ?? distroInfo(distro)
    })
    loading.set(key, p)
    void p.finally(() => loading.delete(key))
  }
  return p
}

// O que se sabe da distro: o guardado, se houver (e confere de novo em segundo plano); senão espera
// a conferência.
export async function ensureDistro(distro: string): Promise<DistroInfo | null> {
  const known = distroInfo(distro)
  const fresh = loadDistro(distro)
  return known ?? fresh
}

// Primeira distro com o `claude` instalado, na ordem do `wsl -l` (a padrão vem primeiro).
export function claudeDistro(): string | null {
  for (const d of knownDistros()) if (distroInfo(d)?.claude) return d
  return null
}

// Pasta do usuário no Linux vista pelo Windows. Antes da primeira conferência, um palpite pelo
// próprio caminho (/home/<usuário>/...).
export function homeUnc(distro: string, near?: string): string | null {
  const home = distroInfo(distro)?.home ?? guessHome(near)
  return home ? toUnc(distro, home) : null
}

function guessHome(linux?: string): string | null {
  const m = linux ? /^\/home\/[^/]+/.exec(linux) : null
  return m ? m[0] : linux?.startsWith('/root') ? '/root' : null
}

// Na abertura do app: confere as distros e o que cada uma tem, em segundo plano.
export async function warmUp(): Promise<void> {
  if (!IS_WIN) return
  const ds = await listDistros()
  await Promise.all(ds.map((d) => loadDistro(d)))
}
