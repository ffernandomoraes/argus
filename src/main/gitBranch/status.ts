import { join } from 'node:path'
import type { UncommittedFile } from '../../shared/sessions'
import { git } from './git'
import { findRepo } from './repo'

// Letra do VS Code para o par XY do `git status --porcelain` (X: preparado, Y: na pasta).
function changeKind(xy: string): UncommittedFile['kind'] {
  if (xy === '??') return 'U'
  if (/U|AA|DD/.test(xy)) return '!'
  if (xy.includes('D')) return 'D'
  if (xy.includes('R') || xy.includes('C')) return 'R'
  if (xy.includes('A')) return 'A'
  return 'M'
}

// Saída do `git status --porcelain -z`: cada entrada é "XY caminho", relativo à raiz; renomeado
// ou copiado traz o caminho antigo na entrada seguinte.
function parseStatus(root: string, stdout: string): UncommittedFile[] {
  const entries = stdout.split('\0')
  const files: UncommittedFile[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.length < 4) continue
    const xy = entry.slice(0, 2)
    files.push({ path: join(root, entry.slice(3)), kind: changeKind(xy) })
    if (/[RC]/.test(xy)) i++
  }
  return files
}

async function readStatus(root: string): Promise<UncommittedFile[] | null> {
  try {
    // --no-optional-locks: o status não regrava o index; senão o aviso de mudança no .git
    // dispararia outra leitura, e assim por diante.
    const stdout = await git(root, ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=all'], {
      maxBuffer: 16 * 1024 * 1024
    })
    return parseStatus(root, stdout)
  } catch {
    return null
  }
}

// Cada aviso de mudança chega a todas as janelas, e cada uma pergunta: uma leitura só por
// repositório em andamento, e a última vale por um instante.
const TTL = 1000
const recent = new Map<string, { at: number; files: UncommittedFile[] | null }>()
const running = new Map<string, Promise<UncommittedFile[] | null>>()

// O .git da pasta mudou (commit, add, checkout): a próxima pergunta lê de novo, sem esperar a
// guardada vencer.
export function forgetStatus(folder: string): void {
  const repo = findRepo(folder)
  if (repo) recent.delete(repo.root)
}

// Arquivos não comitados do repositório inteiro, como o contador do VS Code: alterados,
// preparados e novos (cada arquivo novo conta, mesmo dentro de pasta nova).
// Pasta fora de repositório ou git com erro: nulo.
export async function uncommittedFiles(folder: string): Promise<UncommittedFile[] | null> {
  const repo = findRepo(folder)
  if (!repo) return null
  const hit = recent.get(repo.root)
  if (hit && Date.now() - hit.at < TTL) return hit.files
  let job = running.get(repo.root)
  if (!job) {
    job = readStatus(repo.root)
      .then((files) => {
        recent.set(repo.root, { at: Date.now(), files })
        return files
      })
      .finally(() => running.delete(repo.root))
    running.set(repo.root, job)
  }
  return job
}
