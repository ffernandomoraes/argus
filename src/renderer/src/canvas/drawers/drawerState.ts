import { cascadeSpot, DRAWER_DEFAULT_WIDTH, freeSpot, roomForPlan, type AreaSize, type PanelRect } from '../../conversation/FloatingPanel'
import type { LineRange } from '../../conversation/fileLinks'
import type { ActiveConversation, ActiveDesign } from '../CanvasContext'
import type { ProjectData } from '../types'

// Id de um drawer de conversa à vista (d1, d2...): fica o mesmo enquanto ele está aberto, mesmo
// trocando de conversa.
export type SlotId = string

// Arquivo aberto no painel de código. diff: mostra as mudanças desde o último commit em vez do arquivo.
export type OpenFile = { root: string; path: string; lines?: LineRange; diff?: boolean }

type CodeState = {
  open: boolean
  // De qual drawer é o código aberto (com vários à vista, cada um tem a sua pasta).
  slot: SlotId | null
  // Pasta do código aberto por um link numa conversa do canvas (ChatPanelNode); nulo = a do drawer.
  project: ProjectData | null
  file: OpenFile | null
}

// Plano aberto ao lado de um drawer (o markdown inteiro, como estava ao clicar em "Abrir ao lado").
// Sem drawer (pedido por uma conversa do canvas), fica encostado à esquerda, na largura padrão.
// `path`: o .md criado pelo Claude, aberto do mesmo jeito (a janela mostra o caminho).
export type OpenPlan = { slot: SlotId | null; text: string; path?: string }

// Um drawer de conversa. Fixado: fica onde está, e a próxima conversa abre num drawer novo, no
// espaço livre ao lado dos fixados (sem espaço, em cascata por cima). O solto troca de conversa.
export type Drawer = {
  id: SlotId
  conversation: ActiveConversation
  pinned: boolean
  // Posição e tamanho; nulo = ainda não definido (nasce à direita).
  rect: PanelRect | null
}

export type DrawerState = {
  // Na ordem em que abriram: o último aparece por cima.
  drawers: Drawer[]
  // Lugar do último drawer sozinho na tela, lembrado enquanto o app está aberto: o próximo, sem
  // nenhum fixado, nasce ali.
  lastRect: PanelRect | null
  nextId: number
  // Modo design: um drawer de cada vez, no lugar do da conversa.
  design: ActiveDesign | null
  // Código aberto acompanha a pasta da conversa aberta.
  code: CodeState
  // Plano aberto: fica no lugar do código enquanto está à vista.
  plan: OpenPlan | null
}

const CLOSED_CODE: CodeState = { open: false, slot: null, project: null, file: null }

export const INITIAL_DRAWERS: DrawerState = {
  drawers: [],
  lastRect: null,
  nextId: 1,
  design: null,
  code: CLOSED_CODE,
  plan: null
}

export type DrawerAction =
  // area: tamanho da janela, para o drawer novo achar lugar quando o fixado ainda não tem área.
  | { type: 'show'; conversation: ActiveConversation; area: AreaSize }
  | { type: 'closeAll' }
  | { type: 'close'; slot: SlotId }
  | { type: 'replace'; slot: SlotId; conversation: ActiveConversation }
  | { type: 'togglePin'; slot: SlotId }
  | { type: 'rect'; slot: SlotId; rect: PanelRect }
  | { type: 'sessionStarted'; conversationId: string; sessionId: string; nodeId?: string }
  | { type: 'forget'; conversationId: string }
  | { type: 'moved'; conversationId: string; sessionId?: string; nodeId: string }
  | { type: 'openDesign'; design: ActiveDesign | null }
  | { type: 'closeDesign' }
  | { type: 'toggleCode'; slot: SlotId }
  | { type: 'openProjectCode'; project: ProjectData }
  | { type: 'openFile'; slot?: SlotId; project?: ProjectData; file: OpenFile | null }
  | { type: 'selectFile'; root: string; path: string }
  | { type: 'renamedFile'; root: string; from: string; to: string }
  | { type: 'deletedFile'; root: string; path: string }
  | { type: 'fileDiff'; diff: boolean }
  | { type: 'closeFile' }
  | { type: 'closeCode' }
  | { type: 'openPlan'; slot: SlotId | null; text: string; path?: string; area: AreaSize }
  | { type: 'closePlan' }

const withCode = (state: DrawerState, code: CodeState): DrawerState => (code === state.code ? state : { ...state, code })
// Abrir o código (ou um arquivo) fecha o plano: os dois ficam no mesmo lugar.
const withoutPlan = (state: DrawerState): DrawerState => (state.plan ? { ...state, plan: null } : state)

const isSameConversation = (a: ActiveConversation, id: string) => a.conversationId === id || a.sessionId === id

// O arquivo aberto é `path` ou está dentro dele (pasta renomeada ou excluída na árvore).
const touches = (file: OpenFile | null, root: string, path: string): file is OpenFile =>
  !!file && file.root === root && (file.path === path || file.path.startsWith(path + '/'))

// O drawer solto: o que troca de conversa. Com mais de um (um foi desafixado), o mais recente.
export const looseDrawer = (drawers: readonly Drawer[]) => drawers.filter((d) => !d.pinned).pop() ?? null

// Onde nasce um drawer novo: sem fixados, no lugar do último; com eles, no espaço livre ao lado;
// sem espaço, em cascata a partir do último aberto.
function placeNew(state: DrawerState, area: AreaSize): PanelRect | null {
  const placed = state.drawers.filter((d) => d.rect).map((d) => d.rect as PanelRect)
  if (!placed.length) return state.drawers.length ? null : state.lastRect
  const at = placed[placed.length - 1].area ?? area
  return freeSpot(placed, at, DRAWER_DEFAULT_WIDTH) ?? cascadeSpot(placed[placed.length - 1], at)
}

// Abre a conversa no drawer. Já à vista, fica como está. Senão vai para o solto, trocando a dele;
// com todos fixados, abre num drawer novo.
function show(state: DrawerState, conversation: ActiveConversation, area: AreaSize): DrawerState {
  const s = state.design ? { ...state, design: null } : state
  const shown = s.drawers.find((d) => isSameConversation(d.conversation, conversation.conversationId))
  // As tarefas já à vista mostram a pedida agora.
  if (shown) return shown.conversation.tasks ? update(s, shown.id, (d) => ({ ...d, conversation })) : s
  const loose = looseDrawer(s.drawers)
  if (loose) return { ...s, drawers: s.drawers.map((d) => (d === loose ? { ...d, conversation } : d)) }
  const drawer: Drawer = { id: `d${s.nextId}`, conversation, pinned: false, rect: placeNew(s, area) }
  return { ...s, drawers: [...s.drawers, drawer], nextId: s.nextId + 1 }
}

const closeAll = (state: DrawerState): DrawerState => ({ ...state, drawers: [], code: CLOSED_CODE, plan: null })

// Fecha só aquele drawer. O código e o plano fecham junto só se eram dele.
function close(state: DrawerState, slot: SlotId): DrawerState {
  const code = state.code.slot === slot ? CLOSED_CODE : state.code
  const plan = state.plan?.slot === slot ? null : state.plan
  return { ...state, drawers: state.drawers.filter((d) => d.id !== slot), code, plan }
}

const update = (state: DrawerState, slot: SlotId, change: (d: Drawer) => Drawer): DrawerState => ({
  ...state,
  drawers: state.drawers.map((d) => (d.id === slot ? change(d) : d))
})

// Troca a conversa daquele drawer, fixado ou não (o "voltar" do subagente). Já à vista em outro, este
// fecha: a mesma conversa em dois drawers brigaria pela mesma sessão.
function replace(state: DrawerState, slot: SlotId, conversation: ActiveConversation): DrawerState {
  const elsewhere = state.drawers.some((d) => d.id !== slot && isSameConversation(d.conversation, conversation.conversationId))
  return elsewhere ? close(state, slot) : update(state, slot, (d) => ({ ...d, conversation }))
}

// Lugar novo de um drawer. Sozinho na tela, vira o lugar lembrado para o próximo.
function rect(state: DrawerState, slot: SlotId, next: PanelRect): DrawerState {
  const moved = update(state, slot, (d) => ({ ...d, rect: next }))
  return state.drawers.length === 1 && state.drawers[0].id === slot ? { ...moved, lastRect: next } : moved
}

// Conversa nova recebeu o id da sessão no primeiro envio (e, se era solta, o card no canvas). Vem
// do drawer que a mostra e do Canvas (que cria o card), em qualquer ordem: cada aviso completa o
// que trouxer. Fora dos drawers (fechado ou trocado antes da resposta), nada muda aqui.
function sessionStarted(state: DrawerState, conversationId: string, sessionId: string, nodeId?: string): DrawerState {
  const drawer = state.drawers.find((d) => d.conversation.draft && d.conversation.conversationId === conversationId)
  if (!drawer) return state
  const active = drawer.conversation
  if (active.sessionId === sessionId && (!nodeId || active.nodeId === nodeId)) return state
  return update(state, drawer.id, (d) => ({ ...d, conversation: { ...active, sessionId, ...(nodeId && { nodeId }) } }))
}

// A conversa passou a ser de outro card (o Claude a levou para um worktree, ou de volta): os drawers
// que a mostram abrem dele, com a lista de conversas da pasta nova.
function moved(state: DrawerState, conversationId: string, sessionId: string | undefined, nodeId: string): DrawerState {
  const showing = (c: ActiveConversation) => isSameConversation(c, conversationId) || (!!sessionId && isSameConversation(c, sessionId))
  return state.drawers.reduce(
    (next, d) =>
      d.conversation.nodeId !== nodeId && showing(d.conversation)
        ? update(next, d.id, (x) => ({ ...x, conversation: { ...x.conversation, nodeId, ...(sessionId && { sessionId }) } }))
        : next,
    state
  )
}

// Conversa que foi para a Lixeira some dos drawers.
function forget(state: DrawerState, conversationId: string): DrawerState {
  const drawers = state.drawers.filter((d) => !isSameConversation(d.conversation, conversationId))
  if (drawers.length === state.drawers.length) return state
  const gone = !drawers.some((d) => d.id === state.code.slot) && state.code.slot !== null
  const plan = state.plan?.slot && !drawers.some((d) => d.id === state.plan?.slot) ? null : state.plan
  return { ...state, drawers, code: gone ? CLOSED_CODE : state.code, plan }
}

// Plano aberto ao lado do drawer `slot`. Sem espaço à esquerda dele (inclusive no 100% da largura),
// o drawer encolhe ou anda para a direita para caber (roomForPlan).
function openPlan(state: DrawerState, action: Extract<DrawerAction, { type: 'openPlan' }>): DrawerState {
  const plan = { slot: action.slot, text: action.text, ...(action.path && { path: action.path }) }
  const drawer = state.drawers.find((d) => d.id === action.slot)
  if (!drawer?.rect) return { ...state, plan }
  const next = roomForPlan(drawer.rect, action.area)
  return { ...(next === drawer.rect ? state : rect(state, drawer.id, next)), plan }
}

function openFile(state: DrawerState, action: Extract<DrawerAction, { type: 'openFile' }>): DrawerState {
  let code = state.code
  // Pedido por um drawer: o código passa a ser dele.
  if (action.slot) code = { ...code, slot: action.slot, project: null }
  // Pedido por uma conversa do canvas: o código é da pasta dela.
  if (action.project) code = { ...code, project: action.project }
  if (action.file) code = { ...code, open: true, file: action.file }
  return withCode(state, code)
}

// Botão de código do card da pasta: abre o código dela sem drawer. O arquivo aberto só fica se for
// dessa pasta.
function openProjectCode(state: DrawerState, project: ProjectData): DrawerState {
  const { code } = state
  const keep = code.file?.root === project.path ? code.file : null
  return withCode(state, { open: true, slot: null, project, file: keep })
}

function file(state: DrawerState, next: OpenFile | null): DrawerState {
  return next === state.code.file ? state : withCode(state, { ...state.code, file: next })
}

export function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case 'show':
      return show(state, action.conversation, action.area)
    case 'closeAll':
      return closeAll(state)
    case 'close':
      return close(state, action.slot)
    case 'replace':
      return replace(state, action.slot, action.conversation)
    case 'togglePin':
      return update(state, action.slot, (d) => ({ ...d, pinned: !d.pinned }))
    case 'rect':
      return rect(state, action.slot, action.rect)
    case 'sessionStarted':
      return sessionStarted(state, action.conversationId, action.sessionId, action.nodeId)
    case 'forget':
      return forget(state, action.conversationId)
    case 'moved':
      return moved(state, action.conversationId, action.sessionId, action.nodeId)
    // O drawer do design fica no lugar do da conversa (e do código dela).
    case 'openDesign': {
      const closed = closeAll(state)
      return action.design ? { ...closed, design: action.design } : closed
    }
    case 'closeDesign':
      return state.design ? { ...state, design: null } : state
    // Com o plano por cima do código, o botão mostra o código em vez de fechá-lo.
    case 'toggleCode':
      return state.code.open && state.code.slot === action.slot && !state.plan
        ? withCode(state, CLOSED_CODE)
        : withCode(withoutPlan(state), { ...state.code, open: true, slot: action.slot, project: null })
    case 'openProjectCode':
      return openProjectCode(withoutPlan(state), action.project)
    case 'openFile':
      return openFile(action.file ? withoutPlan(state) : state, action)
    case 'selectFile':
      return file(state, { root: action.root, path: action.path })
    case 'renamedFile': {
      const f = state.code.file
      return touches(f, action.root, action.from) ? file(state, { ...f, path: action.to + f.path.slice(action.from.length) }) : state
    }
    case 'deletedFile':
      return touches(state.code.file, action.root, action.path) ? file(state, null) : state
    case 'fileDiff':
      return state.code.file ? file(state, { ...state.code.file, diff: action.diff }) : state
    case 'closeFile':
      return file(state, null)
    case 'closeCode':
      return withCode(state, CLOSED_CODE)
    case 'openPlan':
      return openPlan(state, action)
    case 'closePlan':
      return withoutPlan(state)
  }
}
