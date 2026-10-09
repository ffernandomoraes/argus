import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type NodeChange,
  type XYPosition
} from '@xyflow/react'
import { CodeExplorer } from '../code/CodeExplorer'
import { FileViewer } from '../code/FileViewer'
import { TitleBar } from './TitleBar'
import { Presence } from '../motion'
import { useNodeMotion } from './useNodeMotion'
import { ConversationDrawer } from '../conversation/ConversationDrawer'
import { DesignDrawer } from '../design/DesignDrawer'
import { MemoryModal } from '../memory/MemoryModal'
import { AgentsModal } from '../agents/AgentsModal'
import { DevServersModal } from '../devServers/DevServersModal'
import { PANEL_DEFAULT_WIDTH, PANEL_MARGIN, type PanelRect } from '../conversation/FloatingPanel'
import type { LineRange } from '../conversation/fileLinks'
import { getPreferences } from '../settings/preferences'
import { useAuth } from '../auth/useAuth'
import { AreaNode } from './AreaNode'
import { CanvasContext, type ActiveConversation, type ActiveDesign } from './CanvasContext'
import { CommandBar } from './CommandBar'
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog'
import { ContextMenu, type MenuState } from './ContextMenu'
import { FolderPicker } from './FolderPicker'
import { ChatNode } from './ChatNode'
import { ChatPanelNode } from './ChatPanelNode'
import {
  createChat,
  createChatPanel,
  createFolderInstance,
  createGroup,
  createNote,
  createTerminal,
  displayPath,
  INSTANCE_MIN_HEIGHT,
  INSTANCE_WIDTH,
  looseProject
} from './factory'
import type { ResolvedTheme } from '../theme/useTheme'
import { ViewBar } from './ViewBar'
import { NavBar } from './NavBar'
import { ProjectNode } from './ProjectNode'
import { NoteNode } from './NoteNode'
import { TerminalNode } from './TerminalNode'
import { AllConversationsPanel } from './AllConversationsPanel'
import { AlignmentGuides } from './AlignmentGuides'
import { EdgeFade } from './EdgeFade'
import { loadNodes, useCanvasSync } from './persistence'
import { DESIGN_PREFIX, getSessions, refreshNow, useSessionsVersion } from './sessionsStore'
import { UsageIndicator } from './UsageIndicator'
import { useCanvasAgentTools } from './useCanvasAgentTools'
import { useHistory } from './useHistory'
import { useSpaceHeld } from './useSpaceHeld'
import { IS_WIN, isAbsolutePath, isMod, relativeTo, untildify } from '../platform'
import {
  addNode,
  dropIntoGroup,
  findChatSpot,
  fitAfterResize,
  groupAccount,
  groupUnder,
  leaveGroup,
  placeBeside,
  removeNode,
  rename,
  setNoteText,
  setNoteWidth,
  sizeOf,
  toggleCollapse,
  toggleObscure,
  toggleProjectCollapse
} from './operations'
import { snap, type Guide } from './snapping'
import type { CanvasNode, ConversationSummary, ProjectData, TerminalKind } from './types'
import {
  chatMenu,
  chatPanelMenu,
  conversationMenu,
  groupMenu,
  instanceMenu,
  noteMenu,
  paneMenu,
  terminalMenu,
  type Deps
} from './useContextMenus'

const nodeTypes = {
  area: AreaNode,
  project: ProjectNode,
  terminal: TerminalNode,
  chat: ChatNode,
  chatPanel: ChatPanelNode,
  note: NoteNode
}

// Pasta em que a conversa do bloco roda: a do projeto ou, na conversa solta, a do usuário.
function projectOf(node: CanvasNode | undefined): ProjectData | null {
  if (node?.type === 'project') return node.data
  if (node?.type === 'chat') return looseProject()
  if (node?.type === 'chatPanel') return { name: node.data.projectName ?? 'Sem projeto', path: node.data.path, color: '#71717a' }
  return null
}

// O React Flow desliga o mouse (pointer-events: none) em nó que não é selecionável nem
// arrastável, a menos que exista onNodeClick. Sem isso, com o espaço pressionado (nada
// arrastável nem selecionável), o botão direito nos blocos atravessa para o canvas.
const keepPointerEvents = () => {}

// Tempo com o bloco em cima de um grupo, durante o arraste, para ele entrar sem precisar soltar.
const DWELL_MS = 2000

export function Canvas({ colorMode, onOpenSettings }: { colorMode: ResolvedTheme; onOpenSettings: () => void }) {
  const [nodes, setNodes] = useState<CanvasNode[]>(loadNodes)
  // Câmera com que esta janela estava ao fechar o app; sem ela, enquadra tudo.
  const [savedViewport] = useState(() => window.api.canvas.viewport())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null)
  const [poppedOut, setPoppedOut] = useState<Set<string>>(new Set())
  // Código aberto acompanha a pasta da conversa aberta.
  const [codeOpen, setCodeOpen] = useState(false)
  // Pasta do código aberto por um link numa conversa do canvas (ChatPanelNode); vazio = a do painel.
  const [codeFor, setCodeFor] = useState<ProjectData | null>(null)
  // Posição e tamanho do painel da conversa; lembrados enquanto o app está aberto.
  const [drawerRect, setDrawerRect] = useState<PanelRect | null>(null)
  // Modo design: um drawer de cada vez, no lugar do da conversa. O dele nasce com metade da tela.
  const [activeDesign, setActiveDesign] = useState<ActiveDesign | null>(null)
  // 'all' = todas as pastas; caminho = só a memória daquela pasta.
  const [memoryOpen, setMemoryOpen] = useState<'all' | string | null>(null)
  const [agentsOpen, setAgentsOpen] = useState(false)
  const [devServersOpen, setDevServersOpen] = useState(false)
  // Barra de comando do assistente; voice = abriu já ouvindo.
  const [commandBar, setCommandBar] = useState<{ voice: boolean } | null>(null)
  const closeCommandBar = useCallback(() => setCommandBar(null), [])
  // Painel com todas as conversas de uma pasta (o card do canvas mostra só as mais recentes).
  const [allConversationsNodeId, setAllConversationsNodeId] = useState<string | null>(null)
  const [allConversationsRect, setAllConversationsRect] = useState<PanelRect | null>(null)
  // "Nova pasta" aberto: onde a pasta entra e, se veio de um grupo, em qual.
  const [folderPicker, setFolderPicker] = useState<{ position: XYPosition; groupId?: string } | null>(null)
  // diff: mostra as mudanças desde o último commit em vez do arquivo.
  const [openFile, setOpenFile] = useState<{ root: string; path: string; lines?: LineRange; diff?: boolean } | null>(
    null
  )
  const { screenToFlowPosition, getZoom, fitView, setCenter } = useReactFlow()
  const [guides, setGuides] = useState<Guide[]>([])
  // Grupo que recebe o bloco solto sendo arrastado, se ele for largado agora; fica destacado.
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  // Contagem do bloco parado em cima do grupo destacado; recomeça ao trocar de grupo ou sair dele.
  const dwell = useRef<{ groupId: string; timer: number } | null>(null)
  const stopDwell = () => {
    if (dwell.current) clearTimeout(dwell.current.timer)
    dwell.current = null
  }
  const spaceHeld = useSpaceHeld()
  const auth = useAuth()
  // Interface oculta: só os blocos e a barra de título; as barras do canvas (navegação, zoom, uso)
  // somem até clicar de novo no botão ou repetir ⌘\. Não fica salvo: reabrir o app volta com tudo.
  const [uiHidden, setUiHidden] = useState(false)
  const toggleUi = () => setUiHidden((h) => !h)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMod(e) || e.shiftKey || e.altKey || (e.key !== '\\' && e.code !== 'Backslash')) return
      e.preventDefault()
      setUiHidden((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { nodesRef, change, trackGesture, undo, redo } = useHistory(nodes, setNodes)
  useCanvasSync(nodes, setNodes)
  useCanvasAgentTools(nodesRef, change)
  const sessionsVersion = useSessionsVersion()

  // Blocos apagados ainda sumindo na tela (useNodeMotion): o que o React Flow mandar sobre eles
  // não volta para o estado.
  const leavingRef = useRef<Set<string>>(new Set())
  const onNodesChange = (all: NodeChange<CanvasNode>[]) => {
    const changes = leavingRef.current.size ? all.filter((c) => !('id' in c) || !leavingRef.current.has(c.id)) : all
    if (!changes.length) return
    trackGesture(
      changes.some((c) => (c.type === 'position' && c.dragging) || (c.type === 'dimensions' && c.resizing))
    )
    // Instância que mudou de tamanho empurra a borda do grupo. Só instância: medida do
    // próprio grupo não entra, senão encolher o grupo na mão seria desfeito na hora.
    const resized = changes.filter((c) => c.type === 'dimensions').map((c) => c.id)
    // Instância arrastada contra a borda do grupo: o grupo cresce para aquele lado, junto com o arraste.
    const dragged = changes.flatMap((c) => (c.type === 'position' && c.dragging ? [c.id] : []))
    // Um bloco sendo arrastado encaixa no alinhamento dos vizinhos (vários juntos, não).
    const moves = changes.filter((c) => c.type === 'position' && c.dragging !== undefined)
    const move = moves.length === 1 && moves[0].type === 'position' ? moves[0] : null
    if (move?.position) {
      const snapped = snap(nodesRef.current, move.id, move.position, getZoom())
      move.position = snapped.position
      setGuides(move.dragging ? snapped.guides : [])
    } else if (moves.length) setGuides([])
    setNodes((ns) => {
      const next = applyNodeChanges(changes, ns)
      return resized.length || dragged.length ? fitAfterResize(ns, next, [...resized, ...dragged]) : next
    })
  }

  // ⌘Z / ⇧⌘Z chegam pelo menu Editar do Electron. Em campo de texto, desfaz o texto; na barra
  // de comando vazia, desfaz o que o Claude fez no canvas.
  useEffect(
    () =>
      window.api.onEdit((action) => {
        const el = document.activeElement as HTMLElement | null
        const canvasUndo = el instanceof HTMLInputElement && el.dataset.canvasUndo !== undefined && !el.value
        if (!canvasUndo && el?.closest('input, textarea, [contenteditable="true"]')) document.execCommand(action)
        else if (action === 'undo') undo()
        else redo()
      }),
    [undo, redo]
  )

  // `argus .` num terminal: a pasta entra no centro da tela, ou, se já está no canvas, a tela vai até ela.
  useEffect(() => {
    const off = window.api.cli.onOpen((folder) => {
      let target = nodesRef.current.find((n) => n.type === 'project' && n.data.path === displayPath(folder))
      if (!target) {
        const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        target = createFolderInstance({ x: center.x - INSTANCE_WIDTH / 2, y: center.y - INSTANCE_MIN_HEIGHT / 2 }, folder)
        const node = target
        change((ns) => addNode(ns, node))
      }
      const id = target.id
      setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })))
      // Espera o bloco novo ser medido antes de enquadrar.
      setTimeout(() => fitView({ nodes: [{ id }], padding: 0.3, duration: 300, maxZoom: 1 }), 100)
    })
    window.api.cli.ready()
    return off
  }, [change, nodesRef, screenToFlowPosition, fitView])

  // ⌘K abre a barra de comando para digitar (o botão da barra lateral abre já ouvindo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      setCommandBar((c) => c ?? { voice: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // C com o mouse no canvas: nota nova ali, já para escrever (como o comentário do Figma).
  // Fora do canvas (painel, modal, barras) ou digitando, a tecla é de quem está lá.
  const pointer = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const onMove = (e: PointerEvent) => (pointer.current = { x: e.clientX, y: e.clientY })
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return
      const at = pointer.current
      const under = at && document.elementFromPoint(at.x, at.y)
      if (!at || !under?.closest('.react-flow') || under.closest('.react-flow__panel')) return
      e.preventDefault()
      setMenu(null)
      depsRef.current?.addNote(screenToFlowPosition(at))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [screenToFlowPosition])

  // Delete (no Mac, a tecla ⌫) apaga as notas selecionadas; ⌘Z traz de volta. Só com o foco
  // no canvas: num modal ou num campo de texto, a tecla é de quem está lá.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      if (target !== document.body && !target.closest('.react-flow')) return
      const ids = new Set(nodesRef.current.filter((n) => n.type === 'note' && n.selected).map((n) => n.id))
      if (!ids.size) return
      e.preventDefault()
      change((ns) => ns.filter((n) => !ids.has(n.id)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [change, nodesRef])

  // O menu de uma conversa nasce no ProjectNode, pelo contexto, e precisa dos deps desta renderização.
  const depsRef = useRef<Deps | null>(null)

  const actions = useMemo(
    () => ({
      renamingId,
      startRename: (id: string) => setRenamingId(id),
      finishRename: (id: string, value: string | null) => {
        setRenamingId((cur) => (cur === id ? null : cur))
        const name = value?.trim()
        const node = nodesRef.current.find((n) => n.id === id)
        // A nota não passa por aqui: ela guarda o texto pelo finishNote.
        if (node?.type === 'note') return
        const current = node?.type === 'area' ? node.data.label : node?.data.name
        if (name && name !== current) change((ns) => rename(ns, id, name))
      },
      // Bloco novo nunca entra por cima de outro (addNode).
      addGroup: (position: XYPosition) => {
        const group = createGroup(position)
        change((ns) => addNode(ns, group))
        setRenamingId(group.id)
      },
      // Diferente dos outros blocos, a nota fica onde foi pedida, mesmo em cima de uma pasta:
      // ela é um lembrete sobre o que está embaixo. Em cima de um grupo, entra nele.
      addNote: (position: XYPosition, groupId?: string) => {
        const note = createNote(position)
        change((ns) => (groupId ? addNode(ns, note, groupId) : dropIntoGroup([...ns, note], [note.id])))
        setRenamingId(note.id)
      },
      finishNote: (id: string, text: string) => {
        setRenamingId((cur) => (cur === id ? null : cur))
        const node = nodesRef.current.find((n) => n.id === id)
        // Só o fim do texto: quebras de linha no meio são da nota.
        const value = text.trimEnd()
        if (node?.type === 'note' && value !== node.data.text) change((ns) => setNoteText(ns, id, value))
      },
      setNoteWidth: (id: string, width: number) => change((ns) => setNoteWidth(ns, id, width)),
      // A pasta é escolhida no FolderPicker; ver pickFolder.
      addFolder: (position: XYPosition, groupId?: string) => setFolderPicker({ position, groupId }),
      // Terminal solto no canvas. Sem pasta conhecida, abre na pasta do usuário, sem perguntar.
      addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => {
        const node = createTerminal(position, folder ?? window.api.homeDir, kind)
        change((ns) => addNode(ns, node, groupId))
      },
      closeTerminal: (nodeId: string, name: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        const shell = node?.type === 'terminal' && node.data.kind === 'shell'
        setConfirm({
          title: `Fechar o terminal "${name}"?`,
          description: shell
            ? 'O shell e o que estiver rodando nele são encerrados.'
            : 'A sessão do Claude que roda nele é encerrada. A conversa continua salva.',
          confirmLabel: 'Fechar terminal',
          onConfirm: () => {
            window.api.terminal.kill(nodeId)
            change((ns) => removeNode(ns, nodeId))
          }
        })
      },
      bindTerminalSession: (nodeId: string, sessionId: string) =>
        // Sem histórico: amarrar a conversa não é uma ação para desfazer.
        setNodes((ns) =>
          ns.map((n) =>
            n.id === nodeId && n.type === 'terminal' && !n.data.sessionId ? { ...n, data: { ...n.data, sessionId } } : n
          )
        ),
      toggleGroup: (id: string) => change((ns) => toggleCollapse(ns, id)),
      toggleObscure: (id: string) => change((ns) => toggleObscure(ns, id)),
      toggleProject: (id: string) => change((ns) => toggleProjectCollapse(ns, id)),
      activeConversation,
      openConversation: (nodeId: string, conversationId: string) => {
        // Conversa do modo design: abre o drawer do design, não o chat.
        if (conversationId.startsWith(DESIGN_PREFIX)) {
          setActiveConversation(null)
          closeCode()
          setActiveDesign({ nodeId, designId: conversationId.slice(DESIGN_PREFIX.length) })
          return
        }
        const openIn = getPreferences().openIn
        // Já no canvas: a câmera vai até o bloco dela.
        const panel = chatPanelOf(conversationId)
        if (panel) focusNode(panel.id)
        // Em janela separada (já aberta, ou pela preferência): abre ou traz a janela para frente.
        else if (poppedOut.has(conversationId) || openIn === 'window') popoutConversation(nodeId, conversationId)
        else if (openIn === 'node') pinConversation(nodeId, conversationId)
        else {
          setActiveDesign(null)
          setActiveConversation({ nodeId, conversationId })
        }
      },
      poppedOut,
      newConversation: (nodeId: string) => {
        setActiveDesign(null)
        setActiveConversation({ nodeId, conversationId: `new-${crypto.randomUUID()}`, draft: true })
      },
      newLooseConversation: (position?: XYPosition) => {
        setActiveDesign(null)
        setActiveConversation({ nodeId: null, conversationId: `new-${crypto.randomUUID()}`, draft: true, at: position })
      },
      activeDesign,
      // O drawer do design fica no lugar do da conversa (e do código dela).
      // Na pasta, sem designId, começa um design novo (ela pode ter vários, cada um na lista dela).
      openDesign: (nodeId: string, designId?: string) => {
        setActiveConversation(null)
        closeCode()
        if (nodesRef.current.find((n) => n.id === nodeId)?.type !== 'project') return
        setActiveDesign({ nodeId, designId: designId ?? crypto.randomUUID() })
      },
      openConversationMenu: (e: ReactMouseEvent, nodeId: string, conversation: ConversationSummary) => {
        e.preventDefault()
        // Sem isso, o botão direito sobe até a pasta e abre o menu dela.
        e.stopPropagation()
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (node?.type !== 'project' || !depsRef.current) return
        setMenu({ x: e.clientX, y: e.clientY, items: conversationMenu(depsRef.current, node, conversation) })
      },
      openAllConversations: (nodeId: string) => setAllConversationsNodeId(nodeId),
      openSettings: onOpenSettings,
      openMemory: (projectPath?: string) => setMemoryOpen(projectPath ?? 'all'),
      openAgents: () => setAgentsOpen(true),
      openDevServers: () => setDevServersOpen(true),
      dropTargetId,
      // O bloco sai para fora do grupo e a câmera vai até ele, no zoom em que está.
      leaveGroup: (id: string) => {
        const next = leaveGroup(nodesRef.current, id)
        const node = next.find((n) => n.id === id)
        if (!node || next === nodesRef.current) return
        change(next)
        const { width, height } = sizeOf(node)
        setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: getZoom(), duration: 300 })
      },
      closeChatPanel: (nodeId: string) => change((ns) => removeNode(ns, nodeId)),
      // O painel abre pela pasta (ou pelo card da conversa solta); sem ela no canvas, não tem por onde.
      chatPanelToDrawer: (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (node?.type !== 'chatPanel') return
        const owner = ownerOf(node.data.path, node.data.sessionId)
        if (!owner) return
        change((ns) => removeNode(ns, nodeId))
        setActiveConversation({ nodeId: owner.id, conversationId: node.data.sessionId })
      },
      chatPanelPopout: (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (node?.type !== 'chatPanel') return
        popoutConversation(nodeId, node.data.sessionId)
        change((ns) => removeNode(ns, nodeId))
      },
      openFileFrom: (project: ProjectData, path: string, lines?: LineRange, diff?: boolean) => {
        setCodeFor(project)
        openFileLink(project.path, path, lines, diff)
      }
    }),
    [renamingId, change, nodesRef, activeConversation, activeDesign, poppedOut, onOpenSettings, dropTargetId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Clique na notificação do sistema: abre a conversa pelo bloco dela (conversa solta) ou pelo
  // projeto da pasta. Já aberta no painel, fica como está.
  useEffect(
    () =>
      window.api.chat.onOpen((cwd, sessionId) => {
        const open = actions.activeConversation
        if (open && (open.conversationId === sessionId || open.sessionId === sessionId)) return
        const target = ownerOf(displayPath(cwd), sessionId)
        if (target) actions.openConversation(target.id, sessionId)
      }),
    [actions, nodesRef]
  )

  // Conversa aberta no painel; some sozinha se a pasta ou a conversa for excluída.
  // Conversa sem projeto ainda não enviada não tem bloco: roda na pasta do usuário.
  const drawer = useMemo(() => {
    if (!activeConversation) return null
    const node = nodes.find((n) => n.id === activeConversation.nodeId)
    const loose = node ? node.type === 'chat' : activeConversation.nodeId === null
    const project = node ? projectOf(node) : loose ? looseProject() : null
    if (!project) return null
    const sessions = getSessions(project.path)
    // Conversa nova que já entrou na lista da pasta passa a ser a conversa normal.
    const started = activeConversation.sessionId && sessions.find((c) => c.id === activeConversation.sessionId)
    const conversation: ConversationSummary | undefined = started
      ? started
      : activeConversation.draft
      ? {
          id: activeConversation.conversationId,
          title: 'Nova conversa',
          kind: 'conversa',
          status: 'idle',
          updatedAt: new Date().toISOString(),
          contextPercent: 0,
          sessionId: activeConversation.sessionId,
          draft: true
        }
      : sessions.find((c) => c.id === activeConversation.conversationId)
    // Conta do grupo da pasta (ou do card da conversa solta); fora de grupo, a padrão.
    const account = groupAccount(nodes, node)
    return conversation ? { nodeId: node?.id, parentId: node?.parentId, project, loose, conversation, account } : null
  }, [nodes, activeConversation, sessionsVersion])

  // Tom do grupo que contém o projeto aberto no drawer.
  const groupTint = useMemo(() => {
    const parentId = drawer?.parentId
    const group = parentId ? nodes.find((n) => n.id === parentId) : undefined
    return group?.type === 'area' ? group.data.color : undefined
  }, [drawer, nodes])

  // Design aberto no drawer: um da pasta. Some se a pasta sair do canvas.
  const designView = useMemo(() => {
    if (!activeDesign) return null
    const node = nodes.find((n) => n.id === activeDesign.nodeId)
    if (node?.type !== 'project') return null
    const group = node.parentId ? nodes.find((n) => n.id === node.parentId) : undefined
    return {
      key: activeDesign.designId,
      name: node.data.name,
      target: { designId: activeDesign.designId, projectPath: node.data.path, projectName: node.data.name },
      account: groupAccount(nodes, node),
      tint: group?.type === 'area' ? group.data.color : undefined
    }
  }, [nodes, activeDesign])

  // Pasta do painel de todas as conversas; some junto com a pasta, se ela for excluída.
  const allConversations = useMemo(() => {
    const node = nodes.find((n) => n.id === allConversationsNodeId)
    return node?.type === 'project' ? node : null
  }, [nodes, allConversationsNodeId])

  // Pastas do canvas, sem repetir: cada uma tem seu CLAUDE.md e sua memória automática.
  const memoryProjects = useMemo(() => {
    const seen = new Map<string, { name: string; path: string }>()
    for (const n of nodes) if (n.type === 'project' && !seen.has(n.data.path)) seen.set(n.data.path, { name: n.data.name, path: n.data.path })
    return [...seen.values()]
  }, [nodes])

  // Bloco por onde a conversa abre: o card dela, se for solta, ou a pasta dela.
  function ownerOf(path: string, sessionId: string): CanvasNode | undefined {
    const ns = nodesRef.current
    return (
      ns.find((n) => n.type === 'chat' && n.data.sessionId === sessionId) ??
      ns.find((n) => n.type === 'project' && n.data.path === path)
    )
  }

  function chatPanelOf(conversationId: string): CanvasNode | undefined {
    return nodesRef.current.find((n) => n.type === 'chatPanel' && n.data.sessionId === conversationId)
  }

  // Seleciona o bloco e enquadra ele na tela, sem passar de 100%.
  function focusNode(id: string) {
    setNodes((ns) => ns.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })))
    // Espera o bloco novo ser medido antes de enquadrar.
    setTimeout(() => fitView({ nodes: [{ id }], padding: 0.15, duration: 300, maxZoom: 1 }), 100)
  }

  // Põe a conversa no canvas, ao lado da pasta (ou do card) de onde ela abriu. Se já estiver lá,
  // só vai até ela: a mesma conversa em dois blocos brigaria pela mesma sessão.
  function pinConversation(nodeId: string, conversationId: string) {
    const existing = chatPanelOf(conversationId)
    if (existing) return focusNode(existing.id)
    const anchor = nodesRef.current.find((n) => n.id === nodeId)
    const project = projectOf(anchor)
    const conversation = project && getSessions(project.path).find((c) => c.id === conversationId)
    if (!anchor || !project || !conversation) return
    const node = createChatPanel(project, anchor.type === 'chat', conversation)
    change((ns) => placeBeside(ns, nodeId, node))
    focusNode(node.id)
  }

  // Abre a conversa numa janela própria (ou foca a que já existe).
  function popoutConversation(nodeId: string, conversationId: string) {
    const node = nodesRef.current.find((n) => n.id === nodeId)
    const project = projectOf(node)
    if (!project) return
    const conversation = getSessions(project.path).find((c) => c.id === conversationId)
    if (!conversation) return
    window.api.popout.open(conversationId, { project, conversation, account: groupAccount(nodesRef.current, node) })
    setPoppedOut((s) => new Set(s).add(conversationId))
  }

  useEffect(() => {
    return window.api.popout.onClosed((id) =>
      setPoppedOut((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    )
  }, [])

  // Link de arquivo no chat: abre o código da pasta já com o arquivo. Aceita caminho relativo
  // à pasta ou absoluto dentro dela; fora da pasta, o visualizador não tem acesso.
  const openFileLink = (root: string, path: string, lines?: LineRange, diff?: boolean) => {
    const full = untildify(path)
    // Relativo: já é o caminho na árvore, com "/" (o Claude no Windows pode mandar com barra invertida).
    const rel = isAbsolutePath(full) ? relativeTo(full, untildify(root)) : IS_WIN ? full.replace(/\\/g, '/') : full
    if (!rel) return
    setCodeOpen(true)
    setOpenFile({ root, path: rel.replace(/^\.\//, ''), lines, diff })
  }

  const closeCode = () => {
    setCodeOpen(false)
    setOpenFile(null)
    setCodeFor(null)
  }

  // Pasta do código: a do link clicado numa conversa do canvas ou, sem isso, a do painel.
  const codeProject = codeFor ?? drawer?.project

  // Dentro de um grupo, a pasta entra num lugar livre e o grupo cresce se precisar.
  const pickFolder = (folder: string) => {
    if (!folderPicker) return
    const node = createFolderInstance(folderPicker.position, folder)
    const { groupId } = folderPicker
    change((ns) => addNode(ns, node, groupId))
    setFolderPicker(null)
  }

  // Conversa na Lixeira: some do painel lateral e do canvas, se estiver aberta neles.
  const trashConversation = async (path: string, conversationId: string) => {
    const error = await window.api.sessions.trash(path, conversationId)
    if (error) return setConfirm({ title: 'Não deu para mover a conversa para a Lixeira', description: error })
    setActiveConversation((cur) =>
      cur && (cur.conversationId === conversationId || cur.sessionId === conversationId) ? null : cur
    )
    const panel = chatPanelOf(conversationId)
    if (panel) change((ns) => removeNode(ns, panel.id))
    refreshNow(path)
  }

  const deps: Deps = { nodes, setNodes: change, confirm: setConfirm, auth, trashConversation, ...actions }
  depsRef.current = deps
  const closeMenu = useCallback(() => setMenu(null), [])
  const onPaneContextMenu = (e: ReactMouseEvent | MouseEvent) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setMenu({ x: e.clientX, y: e.clientY, items: paneMenu(deps, position) })
  }

  const onNodeContextMenu = (e: ReactMouseEvent, node: CanvasNode) => {
    e.preventDefault()
    // O projeto lê o remoto do git antes, para o menu já abrir com "Abrir no GitHub".
    if (node.type === 'project') {
      const { clientX: x, clientY: y } = e
      const at = screenToFlowPosition({ x, y })
      void window.api.sessions
        .repoUrl(node.data.path)
        .catch(() => null)
        .then((url) => setMenu({ x, y, items: instanceMenu(depsRef.current ?? deps, node, url, at) }))
      return
    }
    const items =
      node.type === 'area'
        ? groupMenu(deps, node)
        : node.type === 'terminal'
          ? terminalMenu(deps, node)
          : node.type === 'chat'
            ? chatMenu(deps, node)
            : node.type === 'note'
              ? noteMenu(deps, node)
              : chatPanelMenu(deps, node)
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  // Só na tela, não vai para o estado salvo:
  // - instâncias de grupo com o conteúdo oculto somem; o grupo mostra listras no lugar;
  // - instância de grupo arrastada contra a borda passa dela em vez de travar (expandParent),
  //   e o grupo cresce até ela em onNodesChange.
  // A cópia de cada nó é reaproveitada enquanto ele não muda, para o React Flow não redesenhar
  // todas as instâncias a cada quadro de um arraste.
  const flowCopies = useRef(new WeakMap<CanvasNode, { obscured: boolean; node: CanvasNode }>())
  const flowNodes = useMemo(() => {
    const obscured = new Set(nodes.filter((n) => n.type === 'area' && n.data.obscured).map((n) => n.id))
    return nodes.map((n) => {
      if (!n.parentId) return n
      const hide = obscured.has(n.parentId)
      const cached = flowCopies.current.get(n)
      if (cached?.obscured === hide) return cached.node
      const node: CanvasNode = hide ? { ...n, expandParent: true, hidden: true } : { ...n, expandParent: true }
      flowCopies.current.set(n, { obscured: hide, node })
      return node
    })
  }, [nodes])
  const motion = useNodeMotion(flowNodes)
  leavingRef.current = motion.leaving

  return (
    <CanvasContext.Provider value={actions}>
      <ReactFlow
        nodes={motion.shown}
        onNodeClick={keepPointerEvents}
        zoomOnDoubleClick={false}
        onNodesChange={onNodesChange}
        // Bloco solto entra no grupo ao ser largado em cima dele, ou antes, se ficar em cima por
        // DWELL_MS: o arraste continua, já dentro do grupo. Sem histórico próprio: o arraste já
        // gravou, e desfazer volta o bloco para fora de uma vez.
        onNodeDrag={(_, __, dragged) => {
          const target = dragged.map((n) => groupUnder(nodesRef.current, n)).find(Boolean)
          setDropTargetId(target?.id ?? null)
          if (dwell.current?.groupId === target?.id) return
          stopDwell()
          if (!target) return
          const ids = dragged.map((n) => n.id)
          const timer = window.setTimeout(() => {
            dwell.current = null
            setDropTargetId(null)
            setNodes((ns) => dropIntoGroup(ns, ids))
          }, DWELL_MS)
          dwell.current = { groupId: target.id, timer }
        }}
        onNodeDragStop={(_, __, dragged) => {
          stopDwell()
          setDropTargetId(null)
          setNodes((ns) => dropIntoGroup(ns, dragged.map((n) => n.id)))
        }}
        nodeTypes={nodeTypes}
        className={`${spaceHeld ? 'camera-mode' : ''} ${motion.booting ? 'canvas-booting' : ''} ${uiHidden ? 'ui-hidden' : ''}`}
        nodesDraggable={!spaceHeld}
        elementsSelectable={!spaceHeld}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onMoveStart={closeMenu}
        onMoveEnd={(_, viewport) => window.api.canvas.setViewport(viewport)}
        deleteKeyCode={null}
        colorMode={colorMode}
        fitView={!savedViewport}
        defaultViewport={savedViewport ?? undefined}
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1]}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-dots)" />
        <AlignmentGuides guides={guides} />
        <EdgeFade />
        <ViewBar />
        {/* Com o drawer aberto, ⌘+ / ⌘- escalam o drawer em vez do canvas. */}
        <NavBar zoomShortcuts={!drawer} />
        <UsageIndicator />
      </ReactFlow>
      {/* Escurece levemente o canvas com um painel aberto; não bloqueia cliques */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-200 ${
          drawer || allConversations || designView ? 'opacity-[0.22] [[data-theme=light]_&]:opacity-[0.12]' : 'opacity-0'
        }`}
      />
      {/* Na janela (menu Janela, Mission Control), a conversa aberta e o projeto; sem conversa, o nome do app. */}
      <TitleBar
        windowTitle={
          drawer
            ? `${drawer.conversation.title} - ${drawer.project.name}`
            : designView
              ? `Design - ${designView.name}`
              : 'Argus'
        }
        uiHidden={uiHidden}
        onToggleUi={toggleUi}
      />
      <Presence>
        {codeProject && codeOpen && (
          <CodeExplorer
            root={codeProject.path}
            name={codeProject.name}
            selected={openFile?.root === codeProject.path ? openFile.path : null}
            // Sem o painel aberto, o código vai até a borda direita.
            rightOffset={
              !drawer
                ? PANEL_MARGIN
                : drawerRect
                  ? `calc(100% - ${drawerRect.x - PANEL_MARGIN}px)`
                  : PANEL_DEFAULT_WIDTH + PANEL_MARGIN * 2
            }
            onOpenFile={(path) => setOpenFile({ root: codeProject.path, path })}
            onRenamed={(from, to) =>
              setOpenFile((f) =>
                f && f.root === codeProject.path && (f.path === from || f.path.startsWith(from + '/'))
                  ? { ...f, path: to + f.path.slice(from.length) }
                  : f
              )
            }
            onDeleted={(path) =>
              setOpenFile((f) =>
                f && f.root === codeProject.path && (f.path === path || f.path.startsWith(path + '/')) ? null : f
              )
            }
            onClose={closeCode}
          >
            {openFile?.root === codeProject.path && (
              <FileViewer
                // Outro arquivo começa do zero (rolagem, recargas); o mesmo só recarrega.
                key={`${openFile.root}|${openFile.path}`}
                root={openFile.root}
                path={openFile.path}
                lines={openFile.lines}
                diff={!!openFile.diff}
                onDiffChange={(diff) => setOpenFile({ ...openFile, diff })}
                onClose={() => setOpenFile(null)}
                onCloseCode={closeCode}
              />
            )}
          </CodeExplorer>
        )}
      </Presence>
      <Presence>
        {drawer && (
          <ConversationDrawer
            project={drawer.project}
            account={drawer.account}
            loose={drawer.loose}
            tint={groupTint}
            conversation={drawer.conversation}
            codeOpen={codeOpen}
            rect={drawerRect}
            onRectChange={setDrawerRect}
            onToggleCode={() => (codeOpen ? closeCode() : setCodeOpen(true))}
            onOpenFile={(path, lines) => {
              setCodeFor(null)
              openFileLink(drawer.project.path, path, lines)
            }}
            onOpenDiff={(path) => {
              setCodeFor(null)
              openFileLink(drawer.project.path, path, undefined, true)
            }}
            onSessionStarted={(sessionId) => {
              // Conversa sem projeto entra no canvas no primeiro envio, num lugar livre.
              const node =
                activeConversation?.nodeId === null
                  ? createChat(findChatSpot(nodesRef.current, activeConversation.at), sessionId)
                  : undefined
              if (node) change((ns) => [...ns, node])
              setActiveConversation((a) => (a?.draft ? { ...a, sessionId, ...(node && { nodeId: node.id }) } : a))
            }}
            onPopout={() => {
              if (drawer.nodeId) popoutConversation(drawer.nodeId, drawer.conversation.id)
              setActiveConversation(null)
              closeCode()
            }}
            onPinToCanvas={() => {
              if (drawer.nodeId) pinConversation(drawer.nodeId, drawer.conversation.id)
              setActiveConversation(null)
              closeCode()
            }}
            onClose={() => {
              setActiveConversation(null)
              closeCode()
            }}
          />
        )}
      </Presence>
      <Presence>
        {designView && (
          <DesignDrawer
            key={designView.key}
            target={designView.target}
            account={designView.account}
            tint={designView.tint}
            onClose={() => setActiveDesign(null)}
          />
        )}
      </Presence>
      {/* Depois do drawer: os dois nascem no mesmo lugar, e a lista tem que aparecer por cima. */}
      <Presence>
        {allConversations && (
          <AllConversationsPanel
            project={allConversations.data}
            nodeId={allConversations.id}
            active={activeConversation}
            poppedOut={poppedOut}
            rect={allConversationsRect}
            onRectChange={setAllConversationsRect}
            onOpen={(conversationId) => {
              actions.openConversation(allConversations.id, conversationId)
              setAllConversationsNodeId(null)
            }}
            onNew={() => {
              actions.newConversation(allConversations.id)
              setAllConversationsNodeId(null)
            }}
            onClose={() => setAllConversationsNodeId(null)}
          />
        )}
      </Presence>
      <Presence kind="modal">
        {memoryOpen && (
          <MemoryModal
            projects={memoryProjects}
            only={memoryOpen === 'all' ? undefined : memoryOpen}
            initialProject={drawer && !drawer.loose ? drawer.project.path : undefined}
            onClose={() => setMemoryOpen(null)}
          />
        )}
      </Presence>
      <Presence kind="modal">
        {agentsOpen && <AgentsModal onClose={() => setAgentsOpen(false)} />}
      </Presence>
      <Presence kind="modal">
        {devServersOpen && (
          <DevServersModal paths={memoryProjects.map((p) => p.path)} onClose={() => setDevServersOpen(false)} />
        )}
      </Presence>
      <Presence kind="modal">
        {folderPicker && (
          <FolderPicker
            onCanvas={new Set(memoryProjects.map((p) => p.path))}
            onPick={pickFolder}
            onClose={() => setFolderPicker(null)}
          />
        )}
      </Presence>
      <Presence kind="menu">
        {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
      </Presence>
      <Presence kind="modal">
        {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      </Presence>
      <Presence kind="modal">
        {commandBar && <CommandBar voice={commandBar.voice} onClose={closeCommandBar} />}
      </Presence>
    </CanvasContext.Provider>
  )
}
