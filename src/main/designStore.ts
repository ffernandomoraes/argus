import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { DESIGN_VERSION, type Design, type DesignSummary } from '../shared/design'
import { readJsonFile, writeJsonAtomicSync } from './lib/jsonFile'

// ~/.argus/design (no pnpm dev, ~/.argus-dev/design, como as contas): uma pasta por design, com o
// design.json dele. O código do protótipo fica no projeto.
const ROOT = join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'design')

// O id vem da tela: só letras, números e hífen, para não escapar da pasta.
const VALID_ID = /^[\w-]{1,64}$/

const dirOf = (id: string) => join(ROOT, id)
const fileOf = (id: string) => join(dirOf(id), 'design.json')

function read(id: string): Design | null {
  const r = readJsonFile<Design>(fileOf(id))
  if (r.status !== 'ok') return null
  const design = r.data
  return design?.id === id && design.version === DESIGN_VERSION && !!design.projectPath ? design : null
}

// Todos os designs, lidos do disco uma vez: a lista de conversas de cada pasta pergunta a cada
// volta (design:list e sessions:list), e ler todos os design.json a cada vez pesava. Daí em
// diante, só o que este app grava e apaga muda a lista.
let cache: Map<string, Design> | null = null

function all(): Map<string, Design> {
  if (cache) return cache
  cache = new Map()
  let ids: string[] = []
  try {
    ids = readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && VALID_ID.test(e.name))
      .map((e) => e.name)
  } catch {
    // Sem a pasta: nenhum design ainda.
  }
  for (const id of ids) {
    const design = read(id)
    if (design) cache.set(id, design)
  }
  return cache
}

export function loadDesign(id: string): Design | null {
  return VALID_ID.test(id) ? (all().get(id) ?? null) : null
}

// Na ordem das pastas no disco (pelo id), como era lendo a pasta a cada vez.
function designsOf(projectPath: string): Design[] {
  return [...all().values()].filter((d) => d.projectPath === projectPath).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// Designs da pasta, para a lista de conversas dela: os que já começaram (conversa ou tela aberta).
export function listDesigns(projectPath: string): DesignSummary[] {
  return designsOf(projectPath)
    .filter((d) => d.sessionId || d.existing)
    .map(({ id, name, updatedAt, sessionId }) => ({ id, name, updatedAt, sessionId }))
}

// Apagar um design: a pasta dele vai para a Lixeira. O código do protótipo fica no projeto.
export async function trashDesign(id: string): Promise<boolean> {
  if (!VALID_ID.test(id)) return false
  return shell.trashItem(dirOf(id)).then(
    () => {
      all().delete(id)
      return true
    },
    () => false
  )
}

// Conversas dos protótipos da pasta: não aparecem soltas na lista, só dentro do design.
export function designSessionIds(projectPath: string): Set<string> {
  return new Set(designsOf(projectPath).flatMap((d) => (d.sessionId ? [d.sessionId] : [])))
}

// Grava o design.json por um arquivo temporário, para não ficar pela metade.
export function saveDesign(design: Design): boolean {
  if (!VALID_ID.test(design.id) || design.version !== DESIGN_VERSION || !design.projectPath) return false
  try {
    writeJsonAtomicSync(fileOf(design.id), design, { indent: 2 })
  } catch {
    return false
  }
  all().set(design.id, design)
  return true
}
