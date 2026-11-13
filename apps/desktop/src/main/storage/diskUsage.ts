import { execFile } from 'node:child_process'
import { lstat, opendir } from 'node:fs/promises'
import { join } from 'node:path'
import { IS_WIN } from '../platform'

// Quanto uma pasta ocupa, com tudo dentro. No Mac e no Linux pelo `du`, que mede milhões de arquivos
// em segundos (um rascunho com repositórios clonados chegou a 20 GB e 1,5 milhão de arquivos); no
// Windows, andando pela pasta. Links não são seguidos. Nulo: não deu para medir.

const DU_TIMEOUT_MS = 120_000

function du(path: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile('du', ['-sk', path], { timeout: DU_TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (_err, out) => {
      // Com algum arquivo sem permissão o du sai com erro, mas mede o resto.
      const kb = Number(out?.trim().split(/\s+/)[0])
      resolve(Number.isFinite(kb) ? kb * 1024 : null)
    })
  })
}

async function walk(path: string): Promise<number> {
  const info = await lstat(path).catch(() => null)
  if (!info) return 0
  if (!info.isDirectory()) return info.size
  let total = 0
  const dir = await opendir(path).catch(() => null)
  if (!dir) return 0
  for await (const entry of dir) total += await walk(join(path, entry.name))
  return total
}

export function diskUsage(path: string): Promise<number | null> {
  return IS_WIN ? walk(path).catch(() => null) : du(path)
}
