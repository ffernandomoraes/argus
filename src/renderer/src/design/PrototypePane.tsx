import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Code2, ExternalLink, Eye, Loader2, MessageSquarePlus, RotateCw, X } from 'lucide-react'
import { DEVICE_WIDTH, type Design, type DesignDevice } from '../../../shared/design'
import type { ProjectServer } from '../../../shared/devServers'
import { moveConversationSettings, setConversationSettings, useConversationSettings } from '../conversation/conversationSettings'
import { AccountContext } from '../auth/useAuth'
import { ChatView } from '../conversation/ChatView'
import { McpPanel } from '../conversation/McpPanel'
import { agentHint, mentionedAgents } from '../conversation/AgentMenu'
import type { AgentDef } from '../../../shared/agents'
import { Presence } from '../motion'
import { useConversationHistory } from '../conversation/useConversationHistory'
import { isSendableImage, toBase64, useChat } from '../conversation/useChat'
import { startProjectServer, useProjectServer } from '../devServers/projectServers'
import { BUTTON } from '../settings/controls'
import { pressEscape } from '../useEscape'
import { chatKeyOf, draftKeyOf, existingHint, followHint, markOf, withoutAppLines, type PageInView, nameIn, routeIn, routesIn, sendPrototype, startHint } from './prototype'
import { SideResizer, useSideWidth } from './sideWidth'
import { CommentLayer, commentsHint, commentsText, type CommentPositions, type PageComment } from './comments'
import { appLabel, dedupe, rememberLinks, rememberRoute, RouteField, routesKey, useKnownRoutes, pageApps, type ProjectApp } from './RouteField'

// Coluna da esquerda do drawer: os pedidos e o campo, como uma conversa. A direita fica para a tela.
// A largura vem de useSideWidth (arrastando a borda).
export const SIDE = 'relative flex shrink-0 flex-col border-r border-line'

const ICON_BUTTON = 'flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text'

// O servidor do projeto, no lugar da página enquanto ela não aparece. O que o Claude está fazendo
// fica só no chat.
function serverText(server: ProjectServer | null, running: boolean, checking: boolean): string {
  if (!server) return 'Conferindo o servidor do projeto…'
  if (checking) return 'Conferindo quais portas do projeto mostram página…'
  if (server.state !== 'running') {
    if (server.error) return `O servidor do projeto não subiu: ${server.error}`
    return server.script ? 'Subindo o servidor do projeto…' : 'Esta pasta não tem script dev ou start para mostrar a página.'
  }
  return running
    ? 'O Claude está escrevendo a tela no projeto. A página aparece aqui assim que ele disser o endereço dela.'
    : 'A página aparece aqui pelo servidor do projeto.'
}

// A página do projeto na largura do dispositivo, reduzida para caber e rolando por dentro.
function PrototypeFrame({
  url,
  device,
  reload,
  frameRef,
  onLoad,
  overlay
}: {
  url: string
  device: DesignDevice
  reload: number
  frameRef: RefObject<HTMLIFrameElement | null>
  onLoad: () => void
  // Por cima da página, nas medidas dela (pixels da página), com a mesma redução do quadro.
  overlay?: (scale: number) => ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])
  const width = DEVICE_WIDTH[device]
  const scale = size.width ? Math.min(1, size.width / width) : 1
  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
      {size.width > 0 && (
        <iframe
          key={reload}
          ref={frameRef}
          src={url}
          title="Protótipo"
          onLoad={onLoad}
          // Sem allow-top-navigation: a página não consegue trocar a janela do Argus por ela.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          className="absolute left-1/2 top-0 origin-top border-0 bg-white"
          style={{ width, height: size.height / scale, transform: `translateX(-50%) scale(${scale})` }}
        />
      )}
      {size.width > 0 && overlay && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-10 origin-top overflow-visible"
          style={{ width, height: size.height / scale, transform: `translateX(-50%) scale(${scale})` }}
        >
          {overlay(scale)}
        </div>
      )}
    </div>
  )
}

// Protótipo: a conversa do Claude Code na pasta escreve a tela no código do projeto, e a página
// aparece aqui pelo servidor de desenvolvimento dele, atualizando a cada arquivo salvo. À esquerda
// fica a conversa inteira, a mesma do chat; à direita, a página.
export function PrototypePane({
  design,
  account,
  onUpdate,
  device,
  start,
  viewing = false,
  onViewing
}: {
  design: Design
  account?: string
  // O que a conversa informa (sessão, endereço, nome) e o endereço digitado entram no design.
  onUpdate: (patch: Partial<Design>) => void
  // Largura em que a página aparece agora (a troca Desktop | Celular); sem ela, a do design.
  device?: DesignDevice
  // Design que ainda não começou: no lugar da página, a escolha de como começar.
  start?: ReactNode
  // Visualizar: só a página e a barra de endereço, sem o chat. O botão fica na barra de endereço.
  viewing?: boolean
  onViewing?: () => void
}) {
  const projectPath = design.projectPath
  const key = chatKeyOf(design)
  const sideWidth = useSideWidth()
  const live = useChat(key)
  // A conversa fica de pé enquanto a tela está aberta aqui, como no chat.
  useEffect(() => {
    window.api.chat.retain(key)
    return () => window.api.chat.release(key)
  }, [key])

  const route = design.route
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // Sessão nova: o id vai para a tela, para retomar a conversa depois, e o modelo e o esforço
  // escolhidos antes dela vão junto.
  useEffect(() => {
    if (!live?.sessionId || live.sessionId === design.sessionId) return
    moveConversationSettings(draftKeyOf(design), live.sessionId)
    onUpdateRef.current({ sessionId: live.sessionId })
  }, [live?.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Modelo e esforço: a pessoa escolhe, como na conversa; a troca vale também na conversa já aberta.
  const settings = useConversationSettings(key)
  const changeSettings = (patch: Partial<typeof settings>) => {
    setConversationSettings(key, patch)
    window.api.chat.configure(key, patch)
  }

  // O endereço e o nome chegam no texto da resposta (linhas ROTA e TELA).
  useEffect(() => {
    const text = live?.partial
    if (!text) return
    const nextRoute = routeIn(text)
    const name = nameIn(text)
    if ((nextRoute && nextRoute !== route) || (name && name !== design.name)) {
      onUpdateRef.current({ ...(nextRoute && { route: nextRoute }), ...(name && { name }) })
    }
  }, [live?.partial]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drawer fechado no meio do pedido: as linhas ROTA e TELA ficaram só na conversa. Ao reabrir sem
  // endereço, procura nela (a resposta mais recente vale).
  const sessionId = design.sessionId
  const running = live?.status === 'running' || live?.status === 'needs-you'
  useEffect(() => {
    if (!sessionId || route || running) return
    let alive = true
    void window.api.sessions.history(projectPath, sessionId).then((messages) => {
      const text = messages.filter((m) => m.role === 'assistant').map((m) => m.text).join('\n')
      const found = routeIn(text)
      const name = nameIn(text)
      if (alive && (found || name)) onUpdateRef.current({ ...(found && { route: found }), ...(name && { name }) })
    })
    return () => {
      alive = false
    }
  }, [sessionId, route, running, projectPath])

  // O protótipo é visto pelo servidor do projeto: parado, sobe sozinho (uma vez por abertura) assim
  // que o design começa. Antes disso, a escolha de como começar mostra o servidor e o botão de iniciar.
  const fresh = !sessionId && !design.existing && !route && !running
  const server = useProjectServer(projectPath)
  const tried = useRef(false)
  useEffect(() => {
    if (fresh || server?.state !== 'stopped' || !server.script || server.error || tried.current) return
    tried.current = true
    void startProjectServer(projectPath, true)
  }, [server?.state, fresh]) // eslint-disable-line react-hooks/exhaustive-deps
  const ports = server?.state === 'running' ? server.ports : []
  // Monorepo: o `dev` sobe vários apps, um por porta. A escolha fica no design.
  const allApps: ProjectApp[] = server?.state === 'running' ? (server.apps ?? ports.map((p) => ({ port: p, dir: '' }))) : []
  // Só os que mostram página entram na escolha; sem escolha, abre o primeiro deles (não a API).
  const apps = pageApps(allApps)
  // Até saber quais portas mostram página, nada abre: senão a primeira porta (às vezes a API)
  // apareceria antes do app certo.
  const checking = allApps.some((a) => a.page === undefined)
  const [portChoice, setPortChoice] = useState<number | null>(design.port ?? null)
  // A porta escolhida ao abrir a tela que já existe chega pelo design, depois de montado.
  useEffect(() => {
    if (design.port) setPortChoice(design.port)
  }, [design.port])
  const port = portChoice && ports.includes(portChoice) ? portChoice : (apps[0]?.port ?? ports[0])
  const app = allApps.find((a) => a.port === port)
  const origin = port && !checking ? `http://localhost:${port}` : null
  const rkey = routesKey(projectPath, port)
  const rkeyRef = useRef(rkey)
  rkeyRef.current = rkey
  // Página que a pessoa está vendo: muda ao navegar dentro dela (a própria página avisa, ver
  // trackInPage). `opening` é o caminho que o quadro carrega e só muda pela pessoa: o endereço
  // digitado, o recarregar. A linha ROTA do Claude só abre a página quando ainda não há nenhuma
  // (protótipo novo); depois, muda o endereço guardado da tela sem tirar a pessoa de onde ela está.
  const [current, setCurrent] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [opening, setOpening] = useState<string | null>(route ?? null)
  useEffect(() => {
    if (!opening && route) setOpening(route)
  }, [route]) // eslint-disable-line react-hooks/exhaustive-deps
  const here = current ?? opening ?? route
  const url = origin && opening ? origin + opening : null

  // Recarregar (e o fim de cada pedido) abre de novo a página em que a pessoa está.
  const [reload, setReload] = useState(0)
  const reloadHere = () => {
    if (here) setOpening(here)
    setReload((n) => n + 1)
  }
  // ⌘R / Ctrl+R com a página aberta: recarrega ela, não o app.
  const reloadRef = useRef(reloadHere)
  reloadRef.current = reloadHere
  useEffect(() => (url ? window.api.onReloadKey(() => reloadRef.current()) : undefined), [url])
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) reloadHere()
    wasRunning.current = running
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  // O campo mostra onde a pessoa está (ou o que ela digita), não a ROTA que o Claude informou.
  const [routeDraft, setRouteDraft] = useState(route ?? '')
  useEffect(() => {
    if (!current) setRouteDraft(opening ?? '')
  }, [opening]) // eslint-disable-line react-hooks/exhaustive-deps

  // Avisos da página (scripts de designPicker.ts), por postMessage: endereço, links, comentários.
  const frameRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const data = e.data as { argus?: string }
      if (data?.argus === 'location' && typeof (data as { path?: unknown }).path === 'string') {
        const next = (data as { path: string }).path
        const title = (data as { title?: unknown }).title
        setPageTitle(typeof title === 'string' ? title.slice(0, 120) : '')
        setCurrent(next)
        setRouteDraft(next)
        rememberRoute(rkeyRef.current, next)
      } else if (data?.argus === 'links' && Array.isArray((data as { paths?: unknown }).paths)) {
        rememberLinks(rkeyRef.current, ((data as { paths: unknown[] }).paths).filter((p): p is string => typeof p === 'string'))
      } else if (data?.argus === 'reload') reloadRef.current()
      else if (data?.argus === 'escape' && viewingRef.current) pressEscape()
      else if (data?.argus === 'comment-add') addCommentRef.current(e.data as Record<string, unknown>)
      else if (data?.argus === 'comment-pos') setCommentPos(((e.data as { pos?: CommentPositions }).pos ?? {}) as CommentPositions)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Comentários: ligado, cada clique na página marca um ponto e abre um balão para escrever o que
  // mudar ali. Vários se juntam e vão no próximo envio do chat; depois, somem.
  const [commenting, setCommenting] = useState(false)
  const [comments, setComments] = useState<PageComment[]>([])
  const [commentPos, setCommentPos] = useState<CommentPositions>({})
  const [editingComment, setEditingComment] = useState<number | null>(null)
  const commentApi = (action: 'on' | 'off' | 'remove' | 'clear', id?: number) => origin && window.api.design.comment(origin, action, id)
  const stopCommenting = () => {
    if (!commenting) return
    setCommenting(false)
    commentApi('off')
  }
  const toggleCommenting = () => {
    if (commenting) return stopCommenting()
    setCommenting(true)
    commentApi('on')
  }
  const addCommentRef = useRef((_data: Record<string, unknown>) => {})
  addCommentRef.current = (data) => {
    const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '')
    const id = Number(data.id)
    if (!id) return
    setComments((all) => [
      ...all.filter((c) => c.note.trim() || c.id === editingComment),
      {
        id,
        note: '',
        route: here ?? '/',
        name: str('name') || 'elemento',
        text: str('text'),
        html: str('html'),
        path: str('path'),
        source: str('source'),
        x: Number(data.x) || 0,
        y: Number(data.y) || 0
      }
    ])
    setEditingComment(id)
  }
  const removeComment = (id: number) => {
    setComments((all) => all.filter((c) => c.id !== id))
    setEditingComment((e) => (e === id ? null : e))
    commentApi('remove', id)
  }
  const saveComment = (id: number, note: string) => {
    setComments((all) => all.map((c) => (c.id === id ? { ...c, note } : c)))
    setEditingComment((e) => (e === id ? null : e))
  }
  const discardComments = () => {
    setComments([])
    setEditingComment(null)
    commentApi('clear')
    stopCommenting()
  }
  const ready = comments.filter((c) => c.note.trim())

  // Visualizar: os comentários desligam junto, e o Esc dado dentro da página sai da visualização.
  useEffect(() => {
    if (viewing) stopCommenting()
  }, [viewing]) // eslint-disable-line react-hooks/exhaustive-deps
  const viewingRef = useRef(viewing)
  viewingRef.current = viewing
  useEffect(() => {
    if (origin) window.api.design.escape(origin, viewing)
  }, [origin, viewing])

  const history = useConversationHistory(projectPath, sessionId, design.updatedAt, live?.revision)

  // Lista do campo de endereço: o da tela, as rotas que o Claude informou nesta conversa e as já
  // abertas no projeto (enquanto o app está aberto).
  const known = useKnownRoutes(projectPath, app)
  const said = useMemo(
    () => routesIn(history.messages.filter((m) => m.role === 'assistant').map((m) => m.text).join('\n')),
    [history.messages]
  )
  const routeOptions = dedupe([
    ...(design.route ? [{ route: design.route, name: design.name }] : []),
    ...said.map((r) => ({ route: r, name: 'do Claude' })),
    ...known
  ])
  const goTo = (next: string) => {
    rememberRoute(rkey, next)
    setRouteDraft(next)
    setCurrent(null)
    setOpening(next)
    onUpdate({ route: next })
    setReload((n) => n + 1)
  }

  // Outro app do projeto: abre na página inicial dele, e a escolha fica no design.
  const switchApp = (next: number) => {
    setPortChoice(next)
    setCurrent(null)
    setOpening('/')
    setRouteDraft('/')
    onUpdate({ port: next, route: '/' })
    setReload((n) => n + 1)
  }

  // Quanto da janela de contexto a conversa do protótipo ocupa: relido a cada resposta.
  const [contextPercent, setContextPercent] = useState(0)
  useEffect(() => {
    if (!sessionId) return setContextPercent(0)
    let alive = true
    void window.api.sessions.context(projectPath, sessionId).then((p) => alive && setContextPercent(p))
    return () => {
      alive = false
    }
  }, [projectPath, sessionId, live?.revision, running])

  // /mcp abre a lista de servidores aqui no app, como na conversa.
  const [mcpOpen, setMcpOpen] = useState(false)

  // Agentes para o @, como na conversa: relidos ao abrir o design, para pegar os criados na biblioteca.
  const [agents, setAgents] = useState<AgentDef[]>([])
  useEffect(() => {
    let alive = true
    void window.api.agents.list(projectPath).then((list) => alive && setAgents(list))
    return () => {
      alive = false
    }
  }, [projectPath])

  const send = async (text: string, files: File[]) => {
    const images = await Promise.all(
      files.filter(isSendableImage).map(async (f) => ({ mediaType: f.type, data: await toBase64(f) }))
    )
    // A primeira mensagem da conversa leva o que fazer: criar a tela do zero, ou ajustar a que já
    // existe. Todas, a página que a pessoa está vendo. Comando (/compact, /clear...) vai sozinho:
    // com texto junto, o Claude Code não o reconhece como comando.
    const command = text.trimStart().startsWith('/')
    // Comentários escritos vão junto (o texto deles já veio montado pelo chat, ver extraSend).
    const withComments = !command && ready.length > 0
    const marks = withComments ? markOf('comentarios', ready.length === 1 ? '1 comentário' : `${ready.length} comentários`) : ''
    // O estado da tela, lido na hora (no máximo 0,8s de espera).
    const state = !command && url && origin ? await window.api.design.snapshot(origin) : null
    const hint = command ? '' : contextHint(state) + (withComments ? commentsHint(ready) : '') + (agentHint(mentionedAgents(text, agents)) ?? '') + marks
    sendPrototype({ design, cwd: projectPath, account, text, images, hint })
    // O pedido já foi: os comentários somem e o modo comentar desliga.
    if (withComments) discardComments()
  }

  // O contexto de todo pedido: a página que a pessoa vê (e, no primeiro, o que fazer).
  const contextHint = (state: string | null) => {
    const page: PageInView | undefined = here
      ? {
          path: here,
          title: pageTitle || undefined,
          url: origin ? origin + here : undefined,
          device: device ?? design.device,
          state,
          app: apps.length > 1 && app?.dir ? app.dir : undefined
        }
      : undefined
    return sessionId ? followHint(page) : design.existing ? existingHint(design, here, page) : startHint(design)
  }


  return (
    <AccountContext.Provider value={account}>
      <section className={`${SIDE} ${viewing ? 'hidden' : ''}`} style={{ width: sideWidth }}>
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatView
            draftKey={key}
            messages={history.messages}
            loading={history.loading}
            status={live?.status ?? 'idle'}
            live={live}
            onSend={(text, files) => void send(text, files)}
            loadImages={(id) => (sessionId ? window.api.sessions.images(projectPath, sessionId, id) : Promise.resolve([]))}
            onOpenMcp={() => setMcpOpen(true)}
            onRemoteControl={(enabled) =>
              window.api.chat.remoteControl({ key, cwd: projectPath, account, sessionId, settings, enabled })
            }
            onInterrupt={() => window.api.chat.interrupt(key)}
            onAnswer={(id, answer) => window.api.chat.answer(key, id, answer)}
            settings={settings}
            onSettingChange={changeSettings}
            contextPercent={contextPercent}
            compact
            agents={agents}
            composerAbove={
              <div className="mb-1.5 flex items-center gap-1">
                <button
                  onClick={toggleCommenting}
                  disabled={!url}
                  aria-pressed={commenting}
                  title={url ? 'Clicar na página para deixar comentários, como no Figma' : 'A página ainda não abriu'}
                  className={`flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] disabled:opacity-40 ${
                    commenting ? 'bg-accent/15 text-accent' : 'text-muted enabled:hover:bg-fill enabled:hover:text-text'
                  }`}
                >
                  <MessageSquarePlus size={13} />
                  {commenting ? 'Comentando…' : 'Comentar'}
                </button>
              </div>
            }
            cleanText={withoutAppLines}
            extraSend={ready.length ? { compose: (typed) => (typed ? `${typed}\n\n` : '') + commentsText(ready) } : undefined}
            composerChips={
              comments.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  {comments.length > 0 && (
                    <span
                      title={ready.length ? 'Vão junto com o próximo envio' : 'Escreva nos balões da página'}
                      className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-accent/15 py-0.5 pl-2 pr-1 text-[12px] text-accent"
                    >
                      <MessageSquarePlus size={11} className="shrink-0" />
                      <span className="truncate">{ready.length === 1 ? '1 comentário' : `${ready.length} comentários`}</span>
                      <button
                        aria-label="Descartar os comentários"
                        title="Descartar os comentários"
                        onClick={discardComments}
                        className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-accent/20"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}
                </div>
              )
            }
          />
        </div>
        <SideResizer />
      </section>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra de endereço: também em Visualizar, com folga à direita para os botões dela. */}
        {origin && !fresh && (
          <div className={`flex shrink-0 items-center gap-1.5 border-b border-line py-1.5 pl-3 ${viewing ? 'pr-28' : 'pr-3'}`}>
            {apps.length > 1 ? (
              <select
                value={port}
                onChange={(e) => switchApp(Number(e.target.value))}
                title="App do projeto (o comando dev sobe vários)"
                className="h-6 max-w-40 shrink-0 rounded-md bg-fill px-1.5 text-[12px] text-text outline-none"
              >
                {allApps.filter((a) => apps.includes(a) || a.port === port).map((a) => (
                  <option key={a.port} value={a.port}>
                    {appLabel(a)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 text-[12px] text-faint">{app ? appLabel(app) : `localhost:${port}`}</span>
            )}
            <RouteField value={routeDraft} onChange={setRouteDraft} onGo={goTo} options={routeOptions} />
            <button aria-label="Recarregar a página" title="Recarregar a página" onClick={reloadHere} className={ICON_BUTTON}>
              <RotateCw size={13} />
            </button>
            {onViewing && (
              <button
                aria-label="Visualizar"
                aria-pressed={viewing}
                title={viewing ? 'Voltar ao chat (Esc)' : 'Visualizar: ver só a página, sem o chat'}
                onClick={onViewing}
                className={`${ICON_BUTTON} ${viewing ? 'bg-accent/15 text-accent' : ''}`}
              >
                <Eye size={13} />
              </button>
            )}
            {url && (
              <button aria-label="Abrir no navegador" title="Abrir no navegador" onClick={() => window.open(origin && here ? origin + here : url)} className={ICON_BUTTON}>
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        )}

        {url ? (
          <PrototypeFrame
            url={url}
            device={device ?? design.device}
            reload={reload}
            frameRef={frameRef}
            overlay={(scale) =>
              comments.length > 0 && (
                <CommentLayer
                  comments={comments}
                  route={here ?? '/'}
                  pos={commentPos}
                  scale={scale}
                  editing={editingComment}
                  onEdit={setEditingComment}
                  onSave={saveComment}
                  onRemove={removeComment}
                />
              )
            }
            // Página recarregada: os scripts do app (endereço, comentários, Esc) voltam a ela.
            onLoad={() => {
              if (origin) window.api.design.track(origin)
              if (commenting) commentApi('on')
              if (origin && viewing) window.api.design.escape(origin, true)
            }}
          />
        ) : fresh && start ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{start}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
            {!server || checking || running || server.state === 'starting' ? (
              <Loader2 size={20} className="animate-spin text-faint" />
            ) : (
              <Code2 size={20} className="text-faint" />
            )}
            <p className={`max-w-sm text-xs leading-relaxed ${server?.error ? 'text-red-400' : 'text-faint'}`}>
              {serverText(server, running, checking)}
            </p>
            {server?.state === 'stopped' && server.error && (
              <button onClick={() => void startProjectServer(projectPath, true)} className={`${BUTTON} hover:bg-surface-2`}>
                Tentar de novo
              </button>
            )}
          </div>
        )}
      </div>
      <Presence kind="modal">
        {mcpOpen && <McpPanel conversationKey={key} cwd={projectPath} account={account} onClose={() => setMcpOpen(false)} />}
      </Presence>
    </AccountContext.Provider>
  )
}
