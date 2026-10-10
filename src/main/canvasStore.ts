import { join } from 'node:path'
import { app } from 'electron'
import { errorMessage } from './lib/errors'
import { quarantine, readJsonFile, writeJsonAtomic, writeJsonAtomicSync } from './lib/jsonFile'

// Grupos, pastas e posições do canvas, num JSON nos dados do app.
const file = () => join(app.getPath('userData'), 'canvas.json')
// Cópia do último canvas.json bom, renovada uma vez por abertura, antes da primeira gravação.
const backup = () => file() + '.bak'

// usable = false: o arquivo existe e não deu para usar, nem a cópia. Quem carregou não grava por
// cima até a pessoa mexer no canvas (antes, o canvas vazio da tela apagava tudo em 400 ms).
export type LoadedCanvas = { nodes: unknown; usable: boolean }

// Canvas lido na abertura: vira a cópia antes da primeira gravação desta abertura.
let toBackup: unknown[] | null = null

// Lista de blocos, ou null (canvas novo, ou desfeito até o começo).
const isCanvas = (data: unknown): data is unknown[] | null => data === null || Array.isArray(data)

export function loadCanvas(): LoadedCanvas {
  const r = readJsonFile<unknown>(file())
  if (r.status === 'missing') return { nodes: null, usable: true }
  if (r.status === 'ok' && isCanvas(r.data)) {
    toBackup = r.data
    return { nodes: r.data, usable: true }
  }
  // Ilegível, ou num formato que esta versão não conhece: guarda ao lado com a data e tenta a cópia.
  const kept = quarantine(file())
  console.error('[canvas] canvas.json ilegível:', r.status === 'corrupt' ? r.error : 'formato desconhecido', '- guardado em', kept)
  const bak = readJsonFile<unknown>(backup())
  if (bak.status !== 'ok' || !Array.isArray(bak.data)) return { nodes: null, usable: false }
  console.error('[canvas] voltando para a cópia', backup())
  // Sem conseguir tirar o original do lugar (preso por outro programa, no Windows), nada é
  // gravado por cima dele até a pessoa mexer.
  if (!kept) return { nodes: bak.data, usable: false }
  try {
    writeJsonAtomicSync(file(), bak.data)
  } catch (err) {
    console.error('[canvas] não deu para pôr a cópia no lugar:', errorMessage(err))
  }
  return { nodes: bak.data, usable: true }
}

// Uma vez por abertura, antes de gravar por cima: o canvas que abriu bem vira a cópia de segurança.
function backupOnce(): void {
  if (!toBackup) return
  const data = toBackup
  toBackup = null
  try {
    writeJsonAtomicSync(backup(), data)
  } catch (err) {
    console.error('[canvas] não deu para renovar a cópia:', errorMessage(err))
  }
}

// Grava num temporário só desta gravação e troca: fechar o app no meio não corrompe o arquivo, e
// uma gravação antiga que termina depois não volta o conteúdo (ver lib/atomicWrite.ts).
export function saveCanvas(data: unknown): Promise<void> {
  backupOnce()
  return writeJsonAtomic(file(), data).catch((err) => console.error('[canvas] não deu para salvar:', errorMessage(err)))
}

// Fechando o app: grava na hora, passando na frente das gravações em andamento.
export function saveCanvasNow(data: unknown): void {
  backupOnce()
  try {
    writeJsonAtomicSync(file(), data)
  } catch {
    // Sem gravar, fica o último salvamento.
  }
}

// Blocos salvos, só para consulta (o assistente procura pastas perto das que já estão no canvas).
// Não conserta nada: quem carrega de verdade é o CanvasHub.
export function readSavedNodes(): unknown[] {
  const r = readJsonFile<unknown>(file())
  return r.status === 'ok' && Array.isArray(r.data) ? r.data : []
}
