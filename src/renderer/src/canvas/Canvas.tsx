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
import { ConversationDrawer } from '../conversation/ConversationDrawer'
import { MemoryModal } from '../memory/MemoryModal'
import type { PanelRect } from '../conversation/FloatingPanel'
import type { LineRange } from '../conversation/fileLinks'
import type { SessionSettings } from '../conversation/SessionSettings'
import { getPreferences, usePreferences } from '../settings/preferences'
import { AreaNode } from './AreaNode'
import { CanvasContext, type ActiveConversation } from './CanvasContext'
import { ConfirmDialog, type ConfirmRequest } from './ConfirmDialog'
import { ContextMenu, type MenuState } from './ContextMenu'
import { createFolderInstance, createGroup, createTerminal } from './factory'
import type { ResolvedTheme } from '../theme/useTheme'
import { MiniMapPanel } from './MiniMapPanel'
import { NavBar } from './NavBar'
import { ProjectNode } from './ProjectNode'
import { TerminalNode } from './TerminalNode'
import { AllConversationsPanel } from './AllConversationsPanel'
import { loadNodes, useSaveNodes } from './persistence'
import { getSessions, useSessionsVersion } from './sessionsStore'
import { UsageIndicator } from './UsageIndicator'
import { useHistory } from './useHistory'
import { useSpaceHeld } from './useSpaceHeld'
import { growGroupsToFit, moveToGroup, removeNode, rename, toggleCollapse } from './operations'
import type { CanvasNode, ConversationSummary } from './types'
import { groupMenu, instanceMenu, paneMenu, terminalMenu } from './useContextMenus'

const nodeTypes = { area: AreaNode, project: ProjectNode, terminal: TerminalNode }

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
  const [memoryOpen, setMemoryOpen] = useState(false)
  // Painel com todas as conversas de uma pasta (o card do canvas mostra só as mais recentes).
  const [allConversationsNodeId, setAllConversationsNodeId] = useState<string | null>(null)
  const [allConversationsRect, setAllConversationsRect] = useState<PanelRect | null>(null)
  const [openFile, setOpenFile] = useState<{ root: string; path: string; lines?: LineRange } | null>(null)
  const { screenToFlowPosition } = useReactFlow()
  const spaceHeld = useSpaceHeld()
  const prefs = usePreferences()

  const { nodesRef, change, trackGesture, undo, redo } = useHistory(nodes, setNodes)
  useSaveNodes(nodes)
  const sessionsVersion = useSessionsVersion()

  const onNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    trackGesture(
      changes.some((c) => (c.type === 'position' && c.dragging) || (c.type === 'dimensions' && c.resizing))
    )
    // Instância que mudou de tamanho empurra a borda do grupo. Só instância: medida do
    // próprio grupo não entra, senão encolher o grupo na mão seria desfeito na hora.
    const resized = changes.filter((c) => c.type === 'dimensions').map((c) => c.id)
    setNodes((ns) => {
      const next = applyNodeChanges(changes, ns)
      return resized.length ? growGroupsToFit(next, resized) : next
    })
  }

  // ⌘Z / ⇧⌘Z chegam pelo menu Editar do Electron. Em campo de texto, desfaz o texto.
  useEffect(
    () =>
      window.api.onEdit((action) => {
        const el = document.activeElement as HTMLElement | null
        if (el?.closest('input, textarea, [contenteditable="true"]')) document.execCommand(action)
        else if (action === 'undo') undo()
        else redo()
      }),
    [undo, redo]
  )

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
      // Grupo entra no início do array para ficar atrás das instâncias soltas.
      addGroup: (position: XYPosition) => {
        const group = createGroup(position)
        change((ns) => [group, ...ns])
        setRenamingId(group.id)
      },
      // Dentro de um grupo, a pasta entra num lugar livre e o grupo cresce se precisar.
      addFolder: async (position: XYPosition, groupId?: string) => {
        const folder = await window.api.pickFolder()
        if (!folder) return
        const node = createFolderInstance(position, folder)
        change((ns) => (groupId ? moveToGroup([...ns, node], node.id, groupId) : [...ns, node]))
      },
      // Terminal solto no canvas. Sem pasta conhecida, pergunta qual usar.
      addTerminal: async (position: XYPosition, groupId?: string, folder?: string, sessionId?: string, name?: string) => {
        const chosen = folder ?? (await window.api.pickFolder())
        if (!chosen) return
        const node = createTerminal(position, chosen, sessionId, name)
        change((ns) => (groupId ? moveToGroup([...ns, node], node.id, groupId) : [...ns, node]))
      },
      recentConversations: (path: string) =>
        getSessions(path)
          .slice(0, 8)
          .map((c) => ({ id: c.id, title: c.title })),
      closeTerminal: (nodeId: string, name: string) =>
        setConfirm({
          title: `Fechar o terminal "${name}"?`,
          description: 'A sessão do Claude que roda nele é encerrada. A conversa continua salva.',
          confirmLabel: 'Fechar terminal',
          onConfirm: () => {
            window.api.terminal.kill(nodeId)
            change((ns) => removeNode(ns, nodeId))
          }
        }),
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
      openAllConversations: (nodeId: string) => setAllConversationsNodeId(nodeId),
      openSettings: onOpenSettings,
      openMemory: () => setMemoryOpen(true)
    }),
    [renamingId, change, nodesRef, activeConversation, poppedOut, onOpenSettings] // eslint-disable-line react-hooks/exhaustive-deps
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
  const drawer = useMemo(() => {
    if (!activeConversation) return null
    const project = nodes.find((n) => n.id === activeConversation.nodeId)
    if (project?.type !== 'project') return null
    const sessions = getSessions(project.data.path)
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
    return conversation ? { project, conversation } : null
  }, [nodes, activeConversation, sessionsVersion])

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
    const project = nodesRef.current.find((n) => n.id === nodeId)
    if (project?.type !== 'project') return
    const conversation = getSessions(project.data.path).find((c) => c.id === conversationId)
    if (!conversation) return
    window.api.popout.open(conversationId, {
      project: project.data,
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
  const openFileLink = (root: string, path: string, lines?: LineRange) => {
    const home = window.api.homeDir
    const base = (root.startsWith('~/') ? home + root.slice(1) : root).replace(/\/$/, '')
    let rel = path.startsWith('~/') ? home + path.slice(1) : path
    if (rel.startsWith(base + '/')) rel = rel.slice(base.length + 1)
    else if (rel.startsWith('/')) return
    setCodeOpen(true)
    setOpenFile({ root, path: rel.replace(/^\.\//, ''), lines })
  }

  const closeCode = () => {
    setCodeOpen(false)
    setOpenFile(null)
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
      node.type === 'area' ? groupMenu(deps, node) : node.type === 'terminal' ? terminalMenu(deps, node) : instanceMenu(deps, node)
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
        <MiniMapPanel />
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
      {drawer && codeOpen && (
        <CodeExplorer
          root={drawer.project.data.path}
          name={drawer.project.data.name}
          selected={openFile?.root === drawer.project.data.path ? openFile.path : null}
          onOpenFile={(path) => setOpenFile({ root: drawer.project.data.path, path })}
          onClose={closeCode}
        />
      )}
      {drawer && codeOpen && openFile?.root === drawer.project.data.path && (
        <FileViewer
          // Outro arquivo começa do zero (rolagem, recargas); o mesmo só recarrega.
          key={`${openFile.root}|${openFile.path}`}
          root={openFile.root}
          path={openFile.path}
          lines={openFile.lines}
          rightOffset={drawerRect ? `calc(100% - ${drawerRect.x - 16}px)` : 532}
          onClose={() => setOpenFile(null)}
        />
      )}
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
      {drawer && (
        <ConversationDrawer
          project={drawer.project.data}
          conversation={drawer.conversation}
          settings={settings[drawer.conversation.id] ?? prefs.conversation}
          onSettingsChange={(s) => setSettings((all) => ({ ...all, [drawer.conversation.id]: s }))}
          codeOpen={codeOpen}
          rect={drawerRect}
          onRectChange={setDrawerRect}
          onToggleCode={() => (codeOpen ? closeCode() : setCodeOpen(true))}
          onOpenFile={(path, lines) => openFileLink(drawer.project.data.path, path, lines)}
          onSessionStarted={(sessionId) =>
            setActiveConversation((a) => (a?.draft ? { ...a, sessionId } : a))
          }
          onPopout={() => {
            popoutConversation(drawer.project.id, drawer.conversation.id)
            setActiveConversation(null)
            closeCode()
          }}
          onClose={() => {
            setActiveConversation(null)
            closeCode()
          }}
        />
      )}
      {memoryOpen && (
        <MemoryModal
          projects={memoryProjects}
          initialProject={drawer?.project.data.path}
          onClose={() => setMemoryOpen(false)}
        />
      )}
      {menu && <ContextMenu menu={menu} onClose={closeMenu} />}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </CanvasContext.Provider>
  )
}
