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
import { ConversationDrawer } from '../conversation/ConversationDrawer'
import { MemoryModal } from '../memory/MemoryModal'
import { AgentsModal } from '../agents/AgentsModal'
import { DevServersModal } from '../devServers/DevServersModal'
import type { PanelRect } from '../conversation/FloatingPanel'
import type { LineRange } from '../conversation/fileLinks'
import type { SessionSettings } from '../conversation/SessionSettings'
import { getPreferences, usePreferences } from '../settings/preferences'
import { AreaNode } from './AreaNode'
import { CanvasContext, type ActiveConversation } from './CanvasContext'
import { CommandBar } from './CommandBar'
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog'
import { ContextMenu, type MenuState } from './ContextMenu'
import { FolderPicker } from './FolderPicker'
import { ChatNode } from './ChatNode'
import {
  createChat,
  createFolderInstance,
  createGroup,
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
import { TerminalNode } from './TerminalNode'
import { AllConversationsPanel } from './AllConversationsPanel'
import { AlignmentGuides } from './AlignmentGuides'
import { loadNodes, useSaveNodes } from './persistence'
import { getSessions, useSessionsVersion } from './sessionsStore'
import { UsageIndicator } from './UsageIndicator'
import { useCanvasAgentTools } from './useCanvasAgentTools'
import { useHistory } from './useHistory'
import { useSpaceHeld } from './useSpaceHeld'
import { addNode, findChatSpot, fitAfterResize, removeNode, rename, toggleCollapse } from './operations'
import { snap, type Guide } from './snapping'
import type { CanvasNode, ConversationSummary, ProjectData, TerminalKind } from './types'
import { chatMenu, groupMenu, instanceMenu, paneMenu, terminalMenu } from './useContextMenus'

const nodeTypes = { area: AreaNode, project: ProjectNode, terminal: TerminalNode, chat: ChatNode }

// Pasta em que a conversa do bloco roda: a do projeto ou, na conversa solta, a do usuário.
function projectOf(node: CanvasNode | undefined): ProjectData | null {
  if (node?.type === 'project') return node.data
  if (node?.type === 'chat') return looseProject()
  return null
}

// O React Flow desliga o mouse (pointer-events: none) em nó que não é selecionável nem
// arrastável, a menos que exista onNodeClick. Sem isso, duplo clique e botão direito
// no grupo travado atravessam para o canvas.
const keepPointerEvents = () => {}

export function Canvas({ colorMode, onOpenSettings }: { colorMode: ResolvedTheme; onOpenSettings: () => void }) {
  const [nodes, setNodes] = useState<CanvasNode[]>(loadNodes)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null)
  const [settings, setSettings] = useState<Record<string, SessionSettings>>({})
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const [poppedOut, setPoppedOut] = useState<Set<string>>(new Set())
  // Código aberto acompanha a pasta da conversa aberta.
  const [codeOpen, setCodeOpen] = useState(false)
  // Posição e tamanho do painel da conversa; lembrados enquanto o app está aberto.
  const [drawerRect, setDrawerRect] = useState<PanelRect | null>(null)
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
  const { screenToFlowPosition, getZoom, fitView } = useReactFlow()
  const [guides, setGuides] = useState<Guide[]>([])
  const spaceHeld = useSpaceHeld()
  const prefs = usePreferences()

  const { nodesRef, change, trackGesture, undo, redo } = useHistory(nodes, setNodes)
  useSaveNodes(nodes)
  useCanvasAgentTools(nodesRef, change)
  const sessionsVersion = useSessionsVersion()

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    trackGesture(
      changes.some((c) => (c.type === 'position' && c.dragging) || (c.type === 'dimensions' && c.resizing))
    )
    // Instância que mudou de tamanho empurra a borda do grupo. Só instância: medida do
    // próprio grupo não entra, senão encolher o grupo na mão seria desfeito na hora.
    const resized = changes.filter((c) => c.type === 'dimensions').map((c) => c.id)
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
      return resized.length ? fitAfterResize(ns, next, resized) : next
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

  const actions = useMemo(
    () => ({
      renamingId,
      startRename: (id: string) => setRenamingId(id),
      finishRename: (id: string, value: string | null) => {
        setRenamingId((cur) => (cur === id ? null : cur))
        const name = value?.trim()
        const node = nodesRef.current.find((n) => n.id === id)
        const current = node?.type === 'area' ? node.data.label : node?.data.name
        if (name && name !== current) change((ns) => rename(ns, id, name))
      },
      // Bloco novo nunca entra por cima de outro (addNode).
      addGroup: (position: XYPosition) => {
        const group = createGroup(position)
        change((ns) => addNode(ns, group))
        setRenamingId(group.id)
      },
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
      activeConversation,
      openConversation: (nodeId: string, conversationId: string) => {
        // Em janela separada (já aberta, ou pela preferência): abre ou traz a janela para frente.
        if (poppedOut.has(conversationId) || getPreferences().openIn === 'window') popoutConversation(nodeId, conversationId)
        else setActiveConversation({ nodeId, conversationId })
      },
      poppedOut,
      newConversation: (nodeId: string) =>
        setActiveConversation({ nodeId, conversationId: `new-${crypto.randomUUID()}`, draft: true }),
      newLooseConversation: (position?: XYPosition) =>
        setActiveConversation({ nodeId: null, conversationId: `new-${crypto.randomUUID()}`, draft: true, at: position }),
      openAllConversations: (nodeId: string) => setAllConversationsNodeId(nodeId),
      openSettings: onOpenSettings,
      openMemory: (projectPath?: string) => setMemoryOpen(projectPath ?? 'all'),
      openAgents: () => setAgentsOpen(true),
      openDevServers: () => setDevServersOpen(true),
    }),
    [renamingId, change, nodesRef, activeConversation, poppedOut, onOpenSettings] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Clique na notificação do sistema: abre a conversa pelo bloco dela (conversa solta) ou pelo
  // projeto da pasta. Já aberta no painel, fica como está.
  useEffect(
    () =>
      window.api.chat.onOpen((cwd, sessionId) => {
        const open = actions.activeConversation
        if (open && (open.conversationId === sessionId || open.sessionId === sessionId)) return
        const ns = nodesRef.current
        const target =
          ns.find((n) => n.type === 'chat' && n.data.sessionId === sessionId) ??
          ns.find((n) => n.type === 'project' && n.data.path === displayPath(cwd))
        if (target) actions.openConversation(target.id, sessionId)
      }),
    [actions, nodesRef]
  )

  // Grupo só seleciona e arrasta depois de dois cliques; clique simples não mexe nele.
  const flowNodes = useMemo(
    () => nodes.map((n) => (n.type === 'area' ? { ...n, draggable: !!n.selected, selectable: !!n.selected } : n)),
    [nodes]
  )

  const onNodeDoubleClick = (_e: ReactMouseEvent, node: CanvasNode) => {
    if (node.type !== 'area') return
    setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id })))
  }

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
    return conversation ? { nodeId: node?.id, parentId: node?.parentId, project, loose, conversation } : null
  }, [nodes, activeConversation, sessionsVersion])

  // Tom do grupo que contém o projeto aberto no drawer.
  const groupTint = useMemo(() => {
    const parentId = drawer?.parentId
    const group = parentId ? nodes.find((n) => n.id === parentId) : undefined
    return group?.type === 'area' ? group.data.color : undefined
  }, [drawer, nodes])

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

  // Abre a conversa numa janela própria (ou foca a que já existe).
  function popoutConversation(nodeId: string, conversationId: string) {
    const project = projectOf(nodesRef.current.find((n) => n.id === nodeId))
    if (!project) return
    const conversation = getSessions(project.path).find((c) => c.id === conversationId)
    if (!conversation) return
    window.api.popout.open(conversationId, {
      project,
      conversation,
      settings: settingsRef.current[conversationId] ?? getPreferences().conversation
    })
    setPoppedOut((s) => new Set(s).add(conversationId))
  }

  useEffect(() => {
    const offClosed = window.api.popout.onClosed((id) =>
      setPoppedOut((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    )
    const offSettings = window.api.popout.onSettings((id, s) =>
      setSettings((all) => ({ ...all, [id]: s as SessionSettings }))
    )
    return () => {
      offClosed()
      offSettings()
    }
  }, [])

  // Link de arquivo no chat: abre o código da pasta já com o arquivo. Aceita caminho relativo
  // à pasta ou absoluto dentro dela; fora da pasta, o visualizador não tem acesso.
  const openFileLink = (root: string, path: string, lines?: LineRange, diff?: boolean) => {
    const home = window.api.homeDir
    const base = (root.startsWith('~/') ? home + root.slice(1) : root).replace(/\/$/, '')
    let rel = path.startsWith('~/') ? home + path.slice(1) : path
    if (rel.startsWith(base + '/')) rel = rel.slice(base.length + 1)
    else if (rel.startsWith('/')) return
    setCodeOpen(true)
    setOpenFile({ root, path: rel.replace(/^\.\//, ''), lines, diff })
  }

  const closeCode = () => {
    setCodeOpen(false)
    setOpenFile(null)
  }

  // Dentro de um grupo, a pasta entra num lugar livre e o grupo cresce se precisar.
  const pickFolder = (folder: string) => {
    if (!folderPicker) return
    const node = createFolderInstance(folderPicker.position, folder)
    const { groupId } = folderPicker
    change((ns) => addNode(ns, node, groupId))
    setFolderPicker(null)
  }

  const deps = { nodes, setNodes: change, confirm: setConfirm, ...actions }
  const closeMenu = useCallback(() => setMenu(null), [])

  const onPaneContextMenu = (e: ReactMouseEvent | MouseEvent) => {
    e.preventDefault()
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setMenu({ x: e.clientX, y: e.clientY, items: paneMenu(deps, position) })
  }

  const onNodeContextMenu = (e: ReactMouseEvent, node: CanvasNode) => {
    e.preventDefault()
    const items =
      node.type === 'area'
        ? groupMenu(deps, node)
        : node.type === 'terminal'
          ? terminalMenu(deps, node)
          : node.type === 'chat'
            ? chatMenu(deps, node)
            : instanceMenu(deps, node)
    setMenu({ x: e.clientX, y: e.clientY, items })
  }

  return (
    <CanvasContext.Provider value={actions}>
      <ReactFlow
        nodes={flowNodes}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={keepPointerEvents}
        zoomOnDoubleClick={false}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        className={spaceHeld ? 'camera-mode' : ''}
        nodesDraggable={!spaceHeld}
        elementsSelectable={!spaceHeld}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onMoveStart={closeMenu}
        deleteKeyCode={null}
        colorMode={colorMode}
        fitView
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
        <ViewBar />
        {/* Com o drawer aberto, ⌘+ / ⌘- escalam o drawer em vez do canvas. */}
        <NavBar zoomShortcuts={!drawer} />
        <UsageIndicator />
      </ReactFlow>
      {/* Escurece levemente o canvas com um painel aberto; não bloqueia cliques */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-200 ${
          drawer || allConversations ? 'opacity-[0.22] [[data-theme=light]_&]:opacity-[0.12]' : 'opacity-0'
        }`}
      />
      {/* Como no VS Code: a conversa aberta e o projeto; sem conversa, o nome do app. */}
      <TitleBar title={drawer ? `${drawer.conversation.title} - ${drawer.project.name}` : 'Argus'} />
      {drawer && codeOpen && (
        <CodeExplorer
          root={drawer.project.path}
          name={drawer.project.name}
          selected={openFile?.root === drawer.project.path ? openFile.path : null}
          rightOffset={drawerRect ? `calc(100% - ${drawerRect.x - 16}px)` : 582}
          onOpenFile={(path) => setOpenFile({ root: drawer.project.path, path })}
          onClose={closeCode}
        >
          {openFile?.root === drawer.project.path && (
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
      {drawer && (
        <ConversationDrawer
          project={drawer.project}
          loose={drawer.loose}
          tint={groupTint}
          conversation={drawer.conversation}
          settings={settings[drawer.conversation.id] ?? prefs.conversation}
          onSettingsChange={(s) => setSettings((all) => ({ ...all, [drawer.conversation.id]: s }))}
          codeOpen={codeOpen}
          rect={drawerRect}
          onRectChange={setDrawerRect}
          onToggleCode={() => (codeOpen ? closeCode() : setCodeOpen(true))}
          onOpenFile={(path, lines) => openFileLink(drawer.project.path, path, lines)}
          onOpenDiff={(path) => openFileLink(drawer.project.path, path, undefined, true)}
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
          onClose={() => {
            setActiveConversation(null)
            closeCode()
          }}
        />
      )}
      {/* Depois do drawer: os dois nascem no mesmo lugar, e a lista tem que aparecer por cima. */}
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
      {memoryOpen && (
        <MemoryModal
          projects={memoryProjects}
          only={memoryOpen === 'all' ? undefined : memoryOpen}
          initialProject={drawer && !drawer.loose ? drawer.project.path : undefined}
          onClose={() => setMemoryOpen(null)}
        />
      )}
      {agentsOpen && <AgentsModal onClose={() => setAgentsOpen(false)} />}
      {devServersOpen && <DevServersModal onClose={() => setDevServersOpen(false)} />}
      {folderPicker && (
        <FolderPicker
          onCanvas={new Set(memoryProjects.map((p) => p.path))}
          onPick={pickFolder}
          onClose={() => setFolderPicker(null)}
        />
      )}
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
      {commandBar && <CommandBar voice={commandBar.voice} onClose={closeCommandBar} />}
    </CanvasContext.Provider>
  )
}
