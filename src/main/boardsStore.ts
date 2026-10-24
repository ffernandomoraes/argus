import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { app } from 'electron'
import type { BoardEntry } from '../shared/canvas'
import { mainCanvasFile } from './canvasStore'
import { tr } from './i18n'
import { errorMessage } from './lib/errors'
import { quarantine, readJsonFile, writeJsonAtomicSync } from './lib/jsonFile'

// Workspaces: canvas separados, cada um com nome, trocados no menu da barra de título. Na interface
// é "Workspace"; aqui é "board", porque "workspace" já é o card de várias pastas (workspaces.ts).
// A lista (id, nome e se está fechado, na ordem do menu) fica no boards.json; os blocos de cada um,
// no arquivo dele.

// O primeiro workspace é o canvas.json de antes dos workspaces: quem atualiza encontra o canvas
// dele ali, e voltar para uma versão antiga abre o mesmo canvas.
export const MAIN_BOARD = 'main'

const indexFile = () => join(app.getPath('userData'), 'boards.json')
// Cópia da última lista boa, renovada uma vez por abertura, antes da primeira gravação.
const indexBackup = () => indexFile() + '.bak'
const boardsDir = () => join(app.getPath('userData'), 'boards')

export function boardFile(id: string): string {
  return id === MAIN_BOARD ? mainCanvasFile() : join(boardsDir(), `${id}.json`)
}

const defaultBoards = (): BoardEntry[] => [{ id: MAIN_BOARD, name: tr('Principal', 'Main') }]

// Id gerado pelo app: só letras, números e hífen (vira nome de arquivo).
const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,64}$/.test(id)

// Lista lida na abertura: vira a cópia antes da primeira gravação desta abertura.
let toBackup: BoardEntry[] | null = null

function parse(data: unknown): BoardEntry[] | null {
  if (!Array.isArray(data)) return null
  const seen = new Set<string>()
  return data.flatMap((b: unknown): BoardEntry[] => {
    const { id, name, closed } = (b ?? {}) as Partial<BoardEntry>
    if (!validId(id) || seen.has(id) || typeof name !== 'string') return []
    seen.add(id)
    return [{ id, name, ...(closed === true && { closed }) }]
  })
}

// Canvas na pasta boards/ que não estão na lista (ela estragou, ou foi apagada à mão): voltam como
// "Workspace recuperado", no fim. O de um workspace excluído foi para a Lixeira e não volta.
function withOrphans(boards: BoardEntry[]): BoardEntry[] {
  let files: string[]
  try {
    files = readdirSync(boardsDir())
  } catch {
    return boards
  }
  const known = new Set(boards.map((b) => b.id))
  const orphans = files
    .filter((f) => f.endsWith('.json'))
    .map((f) => basename(f, '.json'))
    .filter((id) => validId(id) && !known.has(id))
  if (!orphans.length) return boards
  console.error('[workspaces] canvas fora da lista, recuperados:', orphans.join(', '))
  return [
    ...boards,
    ...orphans.map((id, i) => ({ id, name: tr(`Workspace recuperado ${i + 1}`, `Recovered workspace ${i + 1}`) }))
  ]
}

// A lista dos workspaces. Estragada, fica guardada ao lado (com a data) e vale a cópia; sem cópia,
// a lista é refeita pelos arquivos (o canvas.json e a pasta boards/), com os nomes perdidos. Nunca
// some um canvas da lista por causa disso: gravar uma lista sem ele deixaria o arquivo esquecido.
export function loadBoards(): BoardEntry[] {
  const r = readJsonFile<unknown>(indexFile())
  let boards = r.status === 'ok' ? parse(r.data) : null
  if (r.status !== 'missing' && !boards) {
    const kept = quarantine(indexFile())
    console.error('[workspaces] boards.json ilegível:', r.status === 'corrupt' ? r.error : 'formato desconhecido', '- guardado em', kept)
    const bak = readJsonFile<unknown>(indexBackup())
    boards = bak.status === 'ok' ? parse(bak.data) : null
  } else if (boards) {
    toBackup = boards
  }
  if (!boards) boards = r.status === 'missing' || existsSync(mainCanvasFile()) ? defaultBoards() : []
  boards = withOrphans(boards)
  if (!boards.length) boards = defaultBoards()
  // Todos fechados (arquivo editado à mão): o primeiro abre, o app sempre mostra um canvas.
  if (boards.every((b) => b.closed)) boards = [{ id: boards[0].id, name: boards[0].name }, ...boards.slice(1)]
  return boards
}

export function saveBoards(boards: BoardEntry[]): void {
  try {
    if (toBackup) {
      writeJsonAtomicSync(indexBackup(), toBackup)
      toBackup = null
    }
    writeJsonAtomicSync(indexFile(), boards)
  } catch (err) {
    console.error('[workspaces] não deu para salvar a lista:', errorMessage(err))
  }
}
