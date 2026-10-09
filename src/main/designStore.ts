import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { DESIGN_VERSION, type Design, type DesignSummary } from '../shared/design'

// ~/.argus/design (no pnpm dev, ~/.argus-dev/design, como as contas): uma pasta por design, com o
// design.json dele. O código do protótipo fica no projeto.
const ROOT = join(homedir(), app.isPackaged ? '.argus' : '.argus-dev', 'design')

// O id vem da tela: só letras, números e hífen, para não escapar da pasta.
const VALID_ID = /^[\w-]{1,64}$/

const dirOf = (id: string) => join(ROOT, id)

function read(id: string): Design | null {
  try {
    const design = JSON.parse(readFileSync(join(dirOf(id), 'design.json'), 'utf8')) as Design
    return design?.id === id && design.version === DESIGN_VERSION && !!design.projectPath ? design : null
  } catch {
    return null
  }
}

export function loadDesign(id: string): Design | null {
  return VALID_ID.test(id) ? read(id) : null
}

function designsOf(projectPath: string): Design[] {
  let ids: string[]
  try {
    ids = readdirSync(ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory() && VALID_ID.test(e.name))
      .map((e) => e.name)
  } catch {
    return []
  }
  return ids.map(read).filter((d): d is Design => d?.projectPath === projectPath)
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
    () => true,
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
  const dir = dirOf(design.id)
  try {
    mkdirSync(dir, { recursive: true })
    const json = join(dir, 'design.json')
    writeFileSync(`${json}.tmp`, JSON.stringify(design, null, 2))
    renameSync(`${json}.tmp`, json)
    return true
  } catch {
    return false
  }
}
