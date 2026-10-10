import type { WebContents } from 'electron'
import { loadCanvas, saveCanvas, saveCanvasNow } from './canvasStore'

const HISTORY_LIMIT = 100
const SAVE_DELAY_MS = 400

// O que a tela mostra quando não havia nada para carregar.
const isEmpty = (nodes: unknown) => nodes == null || (Array.isArray(nodes) && nodes.length === 0)

// O canvas é um só, mesmo aberto em várias janelas (uma por monitor). Cada janela muda a própria
// cópia na hora, para o arraste não esperar ninguém, e manda o resultado para cá; daqui ele vai
// para as outras janelas e para o arquivo. O desfazer também mora aqui: ⌘Z desfaz a última ação,
// feita em qualquer janela.
export class CanvasHub {
  private nodes: unknown
  // O canvas.json existia e não deu para usar: nada é gravado até chegar uma mudança de verdade
  // (uma ação da pessoa, ou blocos onde a tela começou vazia). Senão a janela, ao montar, mandaria
  // o canvas vazio e ele iria para o arquivo.
  private hold: boolean
  private readonly startedEmpty: boolean
  private past: unknown[] = []
  private future: unknown[] = []
  private saveTimer: NodeJS.Timeout | null = null

  // except: a janela que mandou a mudança (ela já está com ela).
  constructor(private send: (nodes: unknown, except: WebContents | null) => void) {
    const loaded = loadCanvas()
    this.nodes = loaded.nodes
    this.hold = !loaded.usable
    this.startedEmpty = isEmpty(loaded.nodes)
  }

  load(): unknown {
    return this.nodes
  }

  sync(nodes: unknown, from: WebContents): void {
    this.nodes = nodes
    if (this.hold && this.startedEmpty && !isEmpty(nodes)) this.hold = false
    this.scheduleSave()
    this.send(nodes, from)
  }

  // Chamado logo antes de cada ação: guarda o canvas como estava.
  record(): void {
    this.hold = false
    this.past.push(this.nodes)
    if (this.past.length > HISTORY_LIMIT) this.past.shift()
    this.future = []
  }

  undo(): void {
    this.step(this.past, this.future)
  }

  redo(): void {
    this.step(this.future, this.past)
  }

  // Sem salvamento pendente, o arquivo já está em dia.
  flush(): void {
    if (!this.saveTimer) return
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    saveCanvasNow(this.nodes)
  }

  private step(from: unknown[], to: unknown[]): void {
    const snapshot = from.pop()
    if (snapshot === undefined) return
    to.push(this.nodes)
    this.nodes = snapshot
    this.scheduleSave()
    // Volta para todas as janelas, inclusive a que pediu.
    this.send(snapshot, null)
  }

  // Salva pouco depois da última mudança, para não gravar a cada quadro de um arraste.
  private scheduleSave(): void {
    if (this.hold) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void saveCanvas(this.nodes)
    }, SAVE_DELAY_MS)
  }
}
