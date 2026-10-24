import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import type { BoardEntry, BoardsState, BoardSummary } from '../shared/canvas'
import { canvasWindowList, setWindowBoard, windowBoard } from './app/canvasRegistry'
import { CanvasHub } from './canvasHub'
import { trashCanvasFile } from './canvasStore'
import { boardFile, loadBoards, saveBoards } from './boardsStore'

type SavedNode = { id?: unknown; type?: unknown; data?: { path?: unknown; sessionId?: unknown } }

// Pastas e conversas soltas de um canvas, para o menu dizer se alguma está trabalhando.
function summarize(entry: BoardEntry, nodes: unknown): BoardSummary {
  const paths = new Set<string>()
  const sessions = new Set<string>()
  for (const n of Array.isArray(nodes) ? (nodes as SavedNode[]) : []) {
    if (n?.type === 'project' && typeof n.data?.path === 'string') paths.add(n.data.path)
    else if ((n?.type === 'chat' || n?.type === 'chatPanel') && typeof n.data?.sessionId === 'string') sessions.add(n.data.sessionId)
  }
  return { ...entry, paths: [...paths], sessions: [...sessions] }
}

// Os workspaces: um CanvasHub por canvas, todos carregados na abertura (o menu mostra o estado das
// conversas de cada um), e qual workspace cada janela mostra. A mudança num canvas só vai para as
// janelas que mostram aquele workspace.
export class Boards {
  private entries: BoardEntry[]
  private hubs = new Map<string, CanvasHub>()
  // Resumo de cada canvas, refeito só quando ele muda (o arraste manda a lista a cada quadro).
  private summaryOf = new Map<string, BoardSummary>()
  // Resumo enviado da última vez: só avisa as janelas quando pastas, conversas ou nomes mudam.
  private lastSent = ''

  constructor(
    private sendRemote: (wc: WebContents, board: string, nodes: unknown) => void,
    private sendBoards: (boards: BoardSummary[]) => void
  ) {
    this.entries = loadBoards()
    for (const entry of this.entries) this.open(entry)
    this.lastSent = JSON.stringify(this.summaries())
  }

  private open(entry: BoardEntry): void {
    const { id } = entry
    const hub = new CanvasHub(boardFile(id), (nodes, except) => {
      for (const win of canvasWindowList()) {
        const wc = win.webContents
        if (wc !== except && this.shownBy(wc) === id) this.sendRemote(wc, id, nodes)
      }
      this.resummarize(id)
      this.announce()
    })
    this.hubs.set(id, hub)
    this.summaryOf.set(id, summarize(entry, hub.load()))
  }

  private resummarize(id: string): void {
    const entry = this.entries.find((e) => e.id === id)
    if (entry) this.summaryOf.set(id, summarize(entry, this.hubs.get(id)?.load()))
  }

  // Workspace pedido por uma janela. Excluído (a janela ainda não soube), nada: cair noutro gravaria
  // o canvas do excluído por cima dele.
  hub(id: string): CanvasHub | undefined {
    return this.hubs.get(id)
  }

  private firstOpen(): string {
    return (this.entries.find((e) => !e.closed) ?? this.entries[0]).id
  }

  private isOpen(id: string): boolean {
    return this.entries.some((e) => e.id === id && !e.closed)
  }

  // O que a janela mostra; sem nada guardado (ou excluído, ou fechado), o primeiro aberto.
  shownBy(wc: WebContents): string {
    const id = windowBoard(wc)
    return id && this.isOpen(id) ? id : this.firstOpen()
  }

  state(wc: WebContents): BoardsState {
    return { boards: this.summaries(), current: this.shownBy(wc) }
  }

  // Fechado (a notificação de uma conversa dele, por exemplo): abre de novo.
  show(wc: WebContents, id: string): void {
    if (!this.hubs.has(id)) return
    if (!this.isOpen(id)) this.reopen(id)
    setWindowBoard(wc, id)
  }

  // Fechar só tira do menu: o canvas fica guardado e os terminais seguem rodando, como num workspace
  // que não está na tela. Volta pela lista dos fechados. O último aberto não fecha.
  close(id: string): void {
    if (!this.isOpen(id) || this.entries.filter((e) => !e.closed).length < 2) return
    this.setClosed(id, true)
  }

  reopen(id: string): void {
    if (this.entries.some((e) => e.id === id && e.closed)) this.setClosed(id, false)
  }

  private setClosed(id: string, closed: boolean): void {
    this.entries = this.entries.map((e) => {
      if (e.id !== id) return e
      if (closed) return { ...e, closed }
      const { closed: _c, ...open } = e
      return open
    })
    this.resummarize(id)
    this.persist()
  }

  create(name: string): string {
    const entry = { id: randomUUID(), name: name.trim() }
    this.entries.push(entry)
    this.open(entry)
    this.persist()
    return entry.id
  }

  rename(id: string, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    this.entries = this.entries.map((e) => (e.id === id ? { ...e, name: trimmed } : e))
    this.resummarize(id)
    this.persist()
  }

  // Exclui de vez um workspace fechado e devolve os blocos que estavam nele (quem chama fecha os
  // terminais). O canvas vai para a Lixeira. Só sai fechado: o aberto passa antes por "Fechar", que
  // dá para desfazer.
  remove(id: string): unknown[] {
    const hub = this.hubs.get(id)
    if (!hub || this.isOpen(id)) return []
    const nodes = hub.load()
    hub.discard()
    this.hubs.delete(id)
    this.summaryOf.delete(id)
    this.entries = this.entries.filter((e) => e.id !== id)
    void trashCanvasFile(boardFile(id))
    this.persist()
    return Array.isArray(nodes) ? nodes : []
  }

  // Blocos que vieram de outro workspace ("Mover para workspace"): vão para o arquivo e para as
  // janelas que mostram ele. Sem passo no desfazer: o ⌘Z daqui tiraria o bloco deste workspace sem
  // devolver ao outro (e um terminal ficaria rodando sem card em nenhum).
  put(id: string, nodes: unknown): void {
    this.hubs.get(id)?.sync(nodes, null)
  }

  // Fechando o app: grava o que estiver pendente em cada canvas.
  flush(): void {
    for (const hub of this.hubs.values()) hub.flush()
  }

  private summaries(): BoardSummary[] {
    return this.entries.flatMap((e) => this.summaryOf.get(e.id) ?? [])
  }

  // Antes da primeira mudança na lista, o boards.json nem existe: o canvas.json sozinho já basta.
  private persist(): void {
    saveBoards(this.entries)
    this.announce()
  }

  private announce(): void {
    const boards = this.summaries()
    const json = JSON.stringify(boards)
    if (json === this.lastSent) return
    this.lastSent = json
    this.sendBoards(boards)
  }
}
