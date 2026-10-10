import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { readSavedNodes } from '../canvasStore'
import { expandHome } from '../paths'
import { IS_WIN } from '../platform'
import { mapLimit } from '../transcripts/mapLimit'

const WINDOWS_ROOTS = [join('OneDrive', 'Desktop'), join('OneDrive', 'Documents'), join('source', 'repos')]
const NO_DIR = /^(\.|node_modules$|Library$|Applications$|Pictures$|Music$|Movies$|AppData$)/
// Limites da procura: pastas abertas, resultados e níveis abaixo de cada lugar (0 a 2 = 3 níveis).
const MAX_VISITED = 6000
const MAX_FOUND = 10
const MAX_DEPTH = 2
// Pastas lidas ao mesmo tempo. Assíncrono: no iCloud e no OneDrive (arquivos sob demanda) cada
// leitura pode demorar, e a leitura síncrona travava o processo principal.
const PARALLEL = 16

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s_.-]+/g, '')

const display = (path: string) => {
  const home = homedir()
  return path === home || path.startsWith(home + sep) ? '~' + path.slice(home.length) : path
}

// Lugares onde costuma haver projeto.
function roots(): string[] {
  const home = homedir()
  // Pais das pastas que já estão no canvas: projetos novos costumam ficar ao lado.
  const known = (readSavedNodes() as { type?: string; data?: { path?: string } }[])
    .filter((n) => n?.type === 'project' && n.data?.path)
    .map((n) => dirname(expandHome(n.data!.path!)))
  return [
    ...new Set([
      ...known,
      // No Windows a Área de Trabalho e os Documentos costumam estar dentro do OneDrive, e o Visual
      // Studio cria os projetos em source\repos.
      ...['Desktop', 'Documents', 'Developer', 'Projects', 'projects', 'code', 'dev', ...(IS_WIN ? WINDOWS_ROOTS : [])].map((d) =>
        join(home, d)
      )
    ])
  ]
}

async function subdirs(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !NO_DIR.test(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
}

// Procura pastas pelo nome nos lugares onde costuma haver projeto, até 3 níveis abaixo. Nível por
// nível, na mesma ordem de antes: o resultado não depende de qual leitura termina primeiro.
export async function findFolders(name: string): Promise<string[]> {
  const wanted = normalize(name)
  const found = new Set<string>()
  const seen = new Set<string>()
  let queue = roots().map((path) => ({ path, depth: 0 }))
  let visited = 0
  while (queue.length && visited < MAX_VISITED && found.size < MAX_FOUND) {
    const level: typeof queue = []
    for (const item of queue) {
      if (seen.has(item.path)) continue
      seen.add(item.path)
      level.push(item)
    }
    visited += level.length
    const listed = await mapLimit(level, PARALLEL, ({ path }) => subdirs(path))
    const next: typeof queue = []
    level.forEach(({ path, depth }, i) => {
      for (const entry of listed[i]) {
        const full = join(path, entry)
        if (normalize(entry).includes(wanted)) found.add(full)
        if (depth < MAX_DEPTH) next.push({ path: full, depth: depth + 1 })
      }
    })
    queue = next
  }
  return [...found].map(display)
}

export async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(expandHome(path))).isDirectory()
  } catch {
    return false
  }
}
