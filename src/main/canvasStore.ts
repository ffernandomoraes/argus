import { existsSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { errorMessage } from './lib/errors'
import { quarantine, readJsonFile, writeJsonAtomic, writeJsonAtomicSync } from './lib/jsonFile'

// Grupos, pastas e posições de um canvas (workspace), num JSON nos dados do app. O primeiro
// workspace fica no canvas.json de sempre (uma versão antiga do app abre ele normalmente); os
// outros, em boards/<id>.json (ver boardsStore.ts). Sem caminho, vale o canvas.json.
export const mainCanvasFile = () => join(app.getPath('userData'), 'canvas.json')
// Cópia do último arquivo bom, renovada uma vez por abertura, antes da primeira gravação.
const backupOf = (file: string) => file + '.bak'

// usable = false: o arquivo existe e não deu para usar, nem a cópia. Quem carregou não grava por
// cima até a pessoa mexer no canvas (antes, o canvas vazio da tela apagava tudo em 400 ms).
export type LoadedCanvas = { nodes: unknown; usable: boolean }

// Canvas lido na abertura, por arquivo: vira a cópia antes da primeira gravação desta abertura.
const toBackup = new Map<string, unknown[]>()

// Lista de blocos, ou null (canvas novo, ou desfeito até o começo).
const isCanvas = (data: unknown): data is unknown[] | null => data === null || Array.isArray(data)

export function loadCanvas(file = mainCanvasFile()): LoadedCanvas {
  const r = readJsonFile<unknown>(file)
  if (r.status === 'missing') return { nodes: null, usable: true }
  if (r.status === 'ok' && isCanvas(r.data)) {
    if (r.data) toBackup.set(file, r.data)
    return { nodes: r.data, usable: true }
  }
  // Ilegível, ou num formato que esta versão não conhece: guarda ao lado com a data e tenta a cópia.
  const kept = quarantine(file)
  console.error('[canvas]', file, 'ilegível:', r.status === 'corrupt' ? r.error : 'formato desconhecido', '- guardado em', kept)
  const bak = readJsonFile<unknown>(backupOf(file))
  if (bak.status !== 'ok' || !Array.isArray(bak.data)) return { nodes: null, usable: false }
  console.error('[canvas] voltando para a cópia', backupOf(file))
  // Sem conseguir tirar o original do lugar (preso por outro programa, no Windows), nada é
  // gravado por cima dele até a pessoa mexer.
  if (!kept) return { nodes: bak.data, usable: false }
  try {
    writeJsonAtomicSync(file, bak.data)
  } catch (err) {
    console.error('[canvas] não deu para pôr a cópia no lugar:', errorMessage(err))
  }
  return { nodes: bak.data, usable: true }
}

// Uma vez por abertura, antes de gravar por cima: o canvas que abriu bem vira a cópia de segurança.
function backupOnce(file: string): void {
  const data = toBackup.get(file)
  if (!data) return
  toBackup.delete(file)
  try {
    writeJsonAtomicSync(backupOf(file), data)
  } catch (err) {
    console.error('[canvas] não deu para renovar a cópia:', errorMessage(err))
  }
}

// Grava num temporário só desta gravação e troca: fechar o app no meio não corrompe o arquivo, e
// uma gravação antiga que termina depois não volta o conteúdo (ver lib/atomicWrite.ts).
export function saveCanvas(data: unknown, file = mainCanvasFile()): Promise<void> {
  backupOnce(file)
  return writeJsonAtomic(file, data).catch((err) => console.error('[canvas] não deu para salvar:', errorMessage(err)))
}

// Fechando o app: grava na hora, passando na frente das gravações em andamento.
export function saveCanvasNow(data: unknown, file = mainCanvasFile()): void {
  backupOnce(file)
  try {
    writeJsonAtomicSync(file, data)
  } catch {
    // Sem gravar, fica o último salvamento.
  }
}

// Workspace excluído: o canvas vai para a Lixeira (dá para recuperar de lá) e a cópia de segurança
// sai. Sem conseguir pôr na Lixeira, fica ao lado com outro nome: nem some de vez, nem volta para a
// lista como workspace recuperado (ver boardsStore.ts).
export async function trashCanvasFile(file: string): Promise<void> {
  toBackup.delete(file)
  try {
    rmSync(backupOf(file), { force: true })
  } catch (err) {
    console.error('[canvas] não deu para apagar a cópia', backupOf(file), errorMessage(err))
  }
  if (!existsSync(file)) return
  try {
    await shell.trashItem(file)
  } catch (err) {
    console.error('[canvas] não deu para pôr na Lixeira', file, errorMessage(err))
    try {
      renameSync(file, `${file}.excluido-${Date.now()}`)
    } catch (e) {
      console.error('[canvas] não deu para tirar do lugar', file, errorMessage(e))
    }
  }
}

// Blocos salvos, só para consulta (o assistente procura pastas perto das que já estão no canvas).
// Não conserta nada: quem carrega de verdade é o CanvasHub.
export function readSavedNodes(file = mainCanvasFile()): unknown[] {
  const r = readJsonFile<unknown>(file)
  return r.status === 'ok' && Array.isArray(r.data) ? r.data : []
}
