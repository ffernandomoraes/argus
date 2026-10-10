import { DRAWER_DEFAULT_WIDTH, freeSpot, type AreaSize, type PanelRect } from '../../conversation/FloatingPanel'
import type { LineRange } from '../../conversation/fileLinks'
import type { ActiveConversation, ActiveDesign } from '../CanvasContext'
import type { ProjectData } from '../types'

// Drawer de conversa: o principal (de cima, quando fixado) ou o segundo, que abre embaixo dele.
export type SlotId = 'main' | 'second'

// Arquivo aberto no painel de código. diff: mostra as mudanças desde o último commit em vez do arquivo.
export type OpenFile = { root: string; path: string; lines?: LineRange; diff?: boolean }

type CodeState = {
  open: boolean
  // De qual drawer é o código aberto (com dois à vista, cada um tem a sua pasta).
  slot: SlotId
  // Pasta do código aberto por um link numa conversa do canvas (ChatPanelNode); nulo = a do drawer.
  project: ProjectData | null
  file: OpenFile | null
}

export type DrawerState = {
  main: ActiveConversation | null
  // Drawer fixado: fica onde está, e a próxima conversa abre num segundo drawer, no espaço livre
  // ao lado dele. Fechar o fixado solta a fixação; o segundo fica onde está.
  second: ActiveConversation | null
  pinned: boolean
  // Posição e tamanho de cada drawer; lembrados enquanto o app está aberto.
  mainRect: PanelRect | null
  secondRect: PanelRect | null
  // Modo design: um drawer de cada vez, no lugar do da conversa.
  design: ActiveDesign | null
  // Código aberto acompanha a pasta da conversa aberta.
  code: CodeState
}

const CLOSED_CODE: CodeState = { open: false, slot: 'main', project: null, file: null }

export const INITIAL_DRAWERS: DrawerState = {
  main: null,
  second: null,
  pinned: false,
  mainRect: null,
  secondRect: null,
  design: null,
  code: CLOSED_CODE
}

export type DrawerAction =
  // area: tamanho da janela, para o segundo drawer achar lugar quando o fixado ainda não tem área.
  | { type: 'show'; conversation: ActiveConversation; area: AreaSize }
  | { type: 'closeAll' }
  | { type: 'close'; slot: SlotId }
  | { type: 'togglePin' }
  | { type: 'rect'; slot: SlotId; rect: PanelRect }
  | { type: 'sessionStarted'; conversationId: string; sessionId: string; nodeId?: string }
  | { type: 'forget'; conversationId: string }
  | { type: 'openDesign'; design: ActiveDesign | null }
  | { type: 'closeDesign' }
  | { type: 'toggleCode'; slot: SlotId }
  | { type: 'openFile'; slot?: SlotId; project?: ProjectData; file: OpenFile | null }
  | { type: 'selectFile'; root: string; path: string }
  | { type: 'renamedFile'; root: string; from: string; to: string }
  | { type: 'deletedFile'; root: string; path: string }
  | { type: 'fileDiff'; diff: boolean }
  | { type: 'closeFile' }
  | { type: 'closeCode' }

const withCode = (state: DrawerState, code: CodeState): DrawerState => (code === state.code ? state : { ...state, code })

const isSameConversation = (a: ActiveConversation, id: string) => a.conversationId === id || a.sessionId === id

// O arquivo aberto é `path` ou está dentro dele (pasta renomeada ou excluída na árvore).
const touches = (file: OpenFile | null, root: string, path: string): file is OpenFile =>
  !!file && file.root === root && (file.path === path || file.path.startsWith(path + '/'))

// Abre a conversa no drawer. Com um fixado, ela vai para o segundo (a fixada já à vista fica como
// está), que nasce no espaço livre ao lado do fixado; com o segundo já aberto, troca a dele.
function show(state: DrawerState, conversation: ActiveConversation, area: AreaSize): DrawerState {
  const s = state.design ? { ...state, design: null } : state
  if (s.pinned && s.main) {
    if (isSameConversation(s.main, conversation.conversationId)) return s
    const secondRect =
      !s.second && s.mainRect ? freeSpot(s.mainRect, s.mainRect.area ?? area, DRAWER_DEFAULT_WIDTH) : s.secondRect
    return { ...s, second: conversation, secondRect }
  }
  if (s.second) return { ...s, second: conversation }
  return { ...s, main: conversation }
}

const closeAll = (state: DrawerState): DrawerState => ({ ...state, main: null, second: null, pinned: false, code: CLOSED_CODE })

// Fechar o de cima solta a fixação. O código fecha junto só se era daquele drawer.
function close(state: DrawerState, slot: SlotId): DrawerState {
  const code = state.code.slot === slot ? CLOSED_CODE : state.code
  return slot === 'main' ? { ...state, main: null, pinned: false, code } : { ...state, second: null, code }
}

// Conversa nova recebeu o id da sessão no primeiro envio (e, se era solta, o card no canvas). Vem
// do drawer que a mostra e do Canvas (que cria o card), em qualquer ordem: cada aviso completa o
// que trouxer. Fora dos drawers (fechado ou trocado antes da resposta), nada muda aqui.
function sessionStarted(state: DrawerState, conversationId: string, sessionId: string, nodeId?: string): DrawerState {
  const slot = (['main', 'second'] as const).find((s) => state[s]?.draft && state[s].conversationId === conversationId)
  const active = slot && state[slot]
  if (!slot || !active) return state
  if (active.sessionId === sessionId && (!nodeId || active.nodeId === nodeId)) return state
  const next = { ...active, sessionId, ...(nodeId && { nodeId }) }
  return slot === 'main' ? { ...state, main: next } : { ...state, second: next }
}

// Conversa que foi para a Lixeira some dos drawers.
function forget(state: DrawerState, conversationId: string): DrawerState {
  const keep = (a: ActiveConversation | null) => (a && isSameConversation(a, conversationId) ? null : a)
  const main = keep(state.main)
  const second = keep(state.second)
  return main === state.main && second === state.second ? state : { ...state, main, second }
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
    case 'togglePin':
      return { ...state, pinned: !state.pinned }
    case 'rect':
      return action.slot === 'main' ? { ...state, mainRect: action.rect } : { ...state, secondRect: action.rect }
    case 'sessionStarted':
      return sessionStarted(state, action.conversationId, action.sessionId, action.nodeId)
    case 'forget':
      return forget(state, action.conversationId)
    // O drawer do design fica no lugar do da conversa (e do código dela).
    case 'openDesign': {
      const closed = closeAll(state)
      return action.design ? { ...closed, design: action.design } : closed
    }
    case 'closeDesign':
      return state.design ? { ...state, design: null } : state
    case 'toggleCode':
      return state.code.open && state.code.slot === action.slot
        ? withCode(state, CLOSED_CODE)
        : withCode(state, { ...state.code, open: true, slot: action.slot, project: null })
    case 'openFile':
      return openFile(state, action)
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
  }
}
