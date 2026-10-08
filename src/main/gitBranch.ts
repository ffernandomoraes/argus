import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type { FileDiff } from '../shared/files'
import type { DiffHunk } from '../shared/history'
import type { UncommittedFile } from '../shared/sessions'
import { expandHome, insideRoot } from './paths'
import { gitPath } from './platform'

const run = promisify(execFile)

// Checkout que contém a pasta: sobe até achar o `.git`. `root` é a raiz dos arquivos;
// `gitDir`, onde o git guarda o HEAD. Em worktree, o `.git` é um arquivo que aponta
// para a pasta dele ("gitdir: ...").
function findRepo(folder: string): { root: string; gitDir: string } | null {
  let dir = resolve(expandHome(folder))
  while (true) {
    const dotGit = join(dir, '.git')
    try {
      if (statSync(dotGit).isDirectory()) return { root: dir, gitDir: dotGit }
      const pointer = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))?.[1].trim()
      if (pointer) return { root: dir, gitDir: resolve(dir, pointer) }
    } catch {
      // Sem `.git` aqui: tenta a pasta de cima.
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function gitDir(folder: string): string | null {
  return findRepo(folder)?.gitDir ?? null
}

// Branch atual lida direto do HEAD, sem rodar o git. HEAD solto (um commit, sem branch)
// vira o hash curto. Pasta fora de repositório: nulo.
export function currentBranch(folder: string): string | null {
  const dir = gitDir(folder)
  if (!dir) return null
  try {
    const head = readFileSync(join(dir, 'HEAD'), 'utf8').trim()
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head)?.[1]
    return ref ?? (/^[0-9a-f]{40}/.test(head) ? head.slice(0, 7) : null)
  } catch {
    return null
  }
}

// Endereço do remoto (o origin; sem ele, o primeiro) em forma de página web. O SSH
// (git@github.com:dono/repo.git ou ssh://git@host/dono/repo) vira https. Pasta fora de
// repositório, sem remoto ou com remoto local: nulo.
export async function repoUrl(folder: string): Promise<string | null> {
  const repo = findRepo(folder)
  if (!repo) return null
  const git = (args: string[]) =>
    run(gitPath(), args, { cwd: repo.root, timeout: 5000, windowsHide: true }).then((r) => r.stdout.trim())
  try {
    const remotes = (await git(['remote'])).split(/\r?\n/).filter(Boolean)
    const name = remotes.includes('origin') ? 'origin' : remotes[0]
    if (!name) return null
    return toWebUrl(await git(['remote', 'get-url', name]))
  } catch {
    return null
  }
}

function toWebUrl(remote: string): string | null {
  const scp = /^[\w.-]+@([^:/]+):(.+)$/.exec(remote)
  const raw = scp ? `https://${scp[1]}/${scp[2]}` : remote.replace(/^(ssh|git):\/\//, 'https://')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    // Usuário e token do remoto não vão para o navegador; a porta do SSH também não vale no https.
    url.username = ''
    url.password = ''
    if (/^(ssh|git):/.test(remote)) url.port = ''
    url.pathname = url.pathname.replace(/\.git\/?$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

// Letra do VS Code para o par XY do `git status --porcelain` (X: preparado, Y: na pasta).
function changeKind(xy: string): UncommittedFile['kind'] {
  if (xy === '??') return 'U'
  if (/U|AA|DD/.test(xy)) return '!'
  if (xy.includes('D')) return 'D'
  if (xy.includes('R') || xy.includes('C')) return 'R'
  if (xy.includes('A')) return 'A'
  return 'M'
}

// Arquivos não comitados do repositório inteiro, como o contador do VS Code: alterados,
// preparados e novos (cada arquivo novo conta, mesmo dentro de pasta nova).
// Pasta fora de repositório ou git com erro: nulo.
export async function uncommittedFiles(folder: string): Promise<UncommittedFile[] | null> {
  const repo = findRepo(folder)
  if (!repo) return null
  try {
    // --no-optional-locks: o status não regrava o index; senão o aviso de mudança no .git
    // dispararia outra leitura, e assim por diante.
    const { stdout } = await run(gitPath(), ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all'], {
      cwd: repo.root,
      timeout: 5000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true
    })
    // Cada entrada é "XY caminho", relativo à raiz; renomeado ou copiado traz o caminho
    // antigo na entrada seguinte.
    const entries = stdout.split('\0')
    const files: UncommittedFile[] = []
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.length < 4) continue
      const xy = entry.slice(0, 2)
      files.push({ path: join(repo.root, entry.slice(3)), kind: changeKind(xy) })
      if (/[RC]/.test(xy)) i++
    }
    return files
  } catch {
    return null
  }
}

// git diff sai com código 1 quando há diferença (--no-index); a saída ainda serve.
async function gitOutput(cwd: string, args: string[]): Promise<string> {
  try {
    return (await run(gitPath(), args, { cwd, timeout: 10_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true })).stdout
  } catch (err) {
    const out = (err as { stdout?: string; code?: number }).stdout
    if ((err as { code?: number }).code === 1 && out) return out
    throw err
  }
}

// Diff unificado → trechos. O cabeçalho (diff --git, ---, +++) fica de fora, e o
// "\ No newline at end of file" também.
function parseDiff(text: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let hunk: DiffHunk | null = null
  for (const line of text.split('\n')) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (m) {
      hunk = { oldStart: Number(m[1]), newStart: Number(m[2]), lines: [] }
      hunks.push(hunk)
    } else if (hunk && /^[ +-]/.test(line)) hunk.lines.push(line)
  }
  return hunks
}

const BINARY = /^Binary files .* differ$/m

// Mudanças do arquivo contra o último commit, juntando o que já foi preparado e o que não.
export async function fileDiff(root: string, rel: string): Promise<FileDiff> {
  const file = insideRoot(root, rel)
  if (!file) return { ok: false, error: 'Caminho fora do projeto.' }
  const repo = findRepo(file)
  if (!repo) return { ok: false, error: 'A pasta não é um repositório git.' }
  try {
    const flags = ['--no-optional-locks', 'diff', '--no-color', '--no-ext-diff']
    let out = await gitOutput(repo.root, [...flags, 'HEAD', '--', file]).catch(() => '')
    // Vazio: sem mudança, ou arquivo novo (o diff contra o HEAD não vê o que está fora do git).
    if (!out) {
      const untracked = await gitOutput(repo.root, ['ls-files', '--others', '--exclude-standard', '--', file])
      if (untracked.trim()) out = await gitOutput(repo.root, [...flags, '--no-index', '--', '/dev/null', file])
    }
    if (BINARY.test(out)) return { ok: false, error: 'Arquivo binário, sem diff.' }
    return { ok: true, hunks: parseDiff(out) }
  } catch (err) {
    return { ok: false, error: `Não consegui gerar o diff: ${(err as Error).message}` }
  }
}
