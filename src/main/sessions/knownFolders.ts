import { readdir, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import type { KnownFolder } from '../../shared/sessions'
import { cwdsIn } from '../transcripts/cwd'
import { mapLimit } from '../transcripts/mapLimit'
import { dirHoldsCwd, projectsDir } from '../transcripts/projectDir'
import { readSlice } from '../transcripts/read'
import { TAIL_BYTES } from './tail'

// Pastas (e arquivos de cada uma) lidos ao mesmo tempo.
const PARALLEL = 8

// Caminho de cada pasta de ~/.claude/projects; não muda, então fica guardado. O "não achou"
// também, enquanto as conversas da pasta forem as mesmas: antes, cada "Nova pasta" relia 1,5 MB
// de cada conversa das pastas que nunca batem.
const folderPaths = new Map<string, string>()
const misses = new Map<string, string>()

// Pastas temporárias (rascunhos de sessões) não são projetos. No Windows, a Temp do usuário.
const TEMP = /^\/(private\/)?(tmp|var\/folders)\//
const isTemp = (path: string) => TEMP.test(path) || path.toLowerCase().startsWith(tmpdir().toLowerCase() + sep)

// O `cwd` costuma estar no começo; numa conversa longa, também no fim.
const CWD_HEAD_BYTES = 1024 * 1024

type Used = { name: string; size: number; mtimeMs: number; mtime: Date }

// O nome achatado não volta ao caminho ("a-b" pode ser "a/b"): o caminho vem do `cwd` gravado
// nas conversas. Vale o que, achatado, dá o próprio nome da pasta; os outros são `cd` no meio.
async function folderPath(dir: string, used: Used[]): Promise<string | null> {
  const known = folderPaths.get(dir)
  if (known) return known
  // Mesmas conversas da última procura sem resultado: não adianta ler de novo.
  const signature = `${used.length}:${used[0].mtimeMs}`
  if (misses.get(dir) === signature) return null
  for (const file of used) {
    const path = join(projectsDir(), dir, file.name)
    const slices = [() => readSlice(path, 0, CWD_HEAD_BYTES)]
    if (file.size > CWD_HEAD_BYTES) slices.push(() => readSlice(path, file.size - TAIL_BYTES, TAIL_BYTES))
    for (const read of slices) {
      for (const cwd of cwdsIn(await read())) {
        if (!dirHoldsCwd(dir, cwd)) continue
        folderPaths.set(dir, cwd)
        misses.delete(dir)
        return cwd
      }
    }
  }
  misses.set(dir, signature)
  return null
}

async function usedFiles(dir: string): Promise<Used[]> {
  const names = (await readdir(join(projectsDir(), dir))).filter((n) => n.endsWith('.jsonl'))
  const files = await mapLimit(names, PARALLEL, async (name) => {
    const info = await stat(join(projectsDir(), dir, name))
    return { name, size: info.size, mtimeMs: info.mtimeMs, mtime: info.mtime }
  })
  // Sessão vazia (aberta e fechada) não conta como conversa.
  return files.filter((f) => f.size > 0).sort((a, b) => b.mtimeMs - a.mtimeMs)
}

// Pastas onde o Claude Code já conversou, da conversa mais recente para a mais antiga. Ficam de
// fora a pasta do usuário (é onde rodam as conversas sem projeto), as temporárias e as que
// não existem mais no disco.
export async function listKnownFolders(): Promise<KnownFolder[]> {
  let dirs: string[]
  try {
    dirs = await readdir(projectsDir())
  } catch {
    return []
  }
  const home = homedir()
  const results = await mapLimit(dirs, PARALLEL, async (dir): Promise<KnownFolder | null> => {
    try {
      const used = await usedFiles(dir)
      if (!used.length) return null
      const path = await folderPath(dir, used)
      if (!path || path === home || isTemp(path)) return null
      if (!(await stat(path)).isDirectory()) return null
      return { path, updatedAt: used[0].mtime.toISOString() }
    } catch {
      return null
    }
  })
  return results
    .filter((f): f is KnownFolder => f !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
