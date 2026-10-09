import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Code2, Crosshair, ExternalLink, Loader2, RotateCw, X } from 'lucide-react'
import { DEVICE_WIDTH, type Design, type DesignDevice } from '../../../shared/design'
import type { ProjectServer } from '../../../shared/devServers'
import { moveConversationSettings, setConversationSettings, useConversationSettings } from '../conversation/conversationSettings'
import { AccountContext } from '../auth/useAuth'
import { ChatView } from '../conversation/ChatView'
import { McpPanel } from '../conversation/McpPanel'
import { Presence } from '../motion'
import { useConversationHistory } from '../conversation/useConversationHistory'
import { isSendableImage, toBase64, useChat } from '../conversation/useChat'
import { startProjectServer, useProjectServer } from '../devServers/projectServers'
import { BUTTON } from '../settings/controls'
import { pressEscape } from '../useEscape'
import { chatKeyOf, draftKeyOf, existingHint, followHint, nameIn, routeIn, routesIn, sendPrototype, startHint, type PrototypePick } from './prototype'
import { SideResizer, useSideWidth } from './sideWidth'
import { rememberRoute, RouteField, visitedRoutes, type RouteOption } from './RouteField'

// Coluna da esquerda do drawer: os pedidos e o campo, como uma conversa. A direita fica para a tela.
// A largura vem de useSideWidth (arrastando a borda).
export const SIDE = 'relative flex shrink-0 flex-col border-r border-line'

const ICON_BUTTON = 'flex size-6 shrink-0 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text'

// O servidor do projeto, no lugar da página enquanto ela não aparece. O que o Claude está fazendo
// fica só no chat.
function serverText(server: ProjectServer | null, running: boolean): string {
  if (!server) return 'Conferindo o servidor do projeto…'
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
  onLoad
}: {
  url: string
  device: DesignDevice
  reload: number
  frameRef: RefObject<HTMLIFrameElement | null>
  onLoad: () => void
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
  viewing = false
}: {
  design: Design
  account?: string
  // O que a conversa informa (sessão, endereço, nome) e o endereço digitado entram no design.
  onUpdate: (patch: Partial<Design>) => void
  // Largura em que a página aparece agora (a troca Desktop | Celular); sem ela, a do design.
  device?: DesignDevice
  // Design que ainda não começou: no lugar da página, a escolha de como começar.
  start?: ReactNode
  // Visualizar: só a página, sem o chat nem a barra de endereço.
  viewing?: boolean
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
    void startProjectServer(projectPath)
  }, [server?.state, fresh]) // eslint-disable-line react-hooks/exhaustive-deps
  const ports = server?.state === 'running' ? server.ports : []
  const [portChoice, setPortChoice] = useState<number | null>(null)
  const port = portChoice && ports.includes(portChoice) ? portChoice : ports[0]
  const origin = port ? `http://localhost:${port}` : null
  // Página que a pessoa está vendo: muda ao navegar dentro dela (a própria página avisa, ver
  // trackInPage). `opening` é o caminho que o quadro carrega; sem ele, o endereço da tela. Endereço
  // novo da tela (digitado ou na linha ROTA) volta a abrir nele.
  const [current, setCurrent] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  useEffect(() => {
    setCurrent(null)
    setOpening(null)
  }, [route])
  const here = current ?? route
  const path = opening ?? route
  const url = origin && path ? origin + path : null

  // Recarregar (e o fim de cada pedido) abre de novo a página em que a pessoa está.
  const [reload, setReload] = useState(0)
  const reloadHere = () => {
    setOpening(here ?? null)
    setReload((n) => n + 1)
  }
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) reloadHere()
    wasRunning.current = running
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const [routeDraft, setRouteDraft] = useState(route ?? '')
  useEffect(() => setRouteDraft(route ?? ''), [route])

  // Seletor de seção: roda dentro da página (designPicker.ts) e devolve a escolha por postMessage.
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [picking, setPicking] = useState(false)
  const [pick, setPick] = useState<PrototypePick | null>(null)
  const accent = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(), [])
  const picker = (on: boolean) => origin && window.api.design.pick(origin, on, accent)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return
      const data = e.data as { argus?: string } & Partial<PrototypePick>
      if (data?.argus === 'pick') {
        // O seletor continua ligado: o clique seguinte, dentro da seção, escolhe um elemento dela.
        setPick({
          name: String(data.name ?? ''),
          secao: data.secao ?? null,
          section: data.section ?? null,
          text: String(data.text ?? ''),
          html: String(data.html ?? '')
        })
      } else if (data?.argus === 'location' && typeof (data as { path?: unknown }).path === 'string') {
        const next = (data as { path: string }).path
        setCurrent(next)
        setRouteDraft(next)
      } else if (data?.argus === 'pick-cancel') setPicking(false)
      else if (data?.argus === 'escape' && viewingRef.current) pressEscape()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  const togglePick = () => {
    if (picking) {
      setPicking(false)
      picker(false)
      return
    }
    setPick(null)
    setPicking(true)
    picker(true)
  }
  const clearPick = () => {
    setPick(null)
    setPicking(false)
    picker(false)
  }

  // Visualizar: o seletor desliga junto, e o Esc dado dentro da página sai da visualização.
  useEffect(() => {
    if (viewing) clearPick()
  }, [viewing]) // eslint-disable-line react-hooks/exhaustive-deps
  const viewingRef = useRef(viewing)
  viewingRef.current = viewing
  useEffect(() => {
    if (origin) window.api.design.escape(origin, viewing)
  }, [origin, viewing])

  const history = useConversationHistory(projectPath, sessionId, design.updatedAt, live?.revision)

  // Lista do campo de endereço: o da tela, as rotas que o Claude informou nesta conversa e as já
  // abertas no projeto (enquanto o app está aberto).
  const routeOptions = useMemo(() => {
    const said = routesIn(history.messages.filter((m) => m.role === 'assistant').map((m) => m.text).join('\n'))
    const all: RouteOption[] = [
      ...(design.route ? [{ route: design.route, name: design.name }] : []),
      ...said.map((r) => ({ route: r })),
      ...visitedRoutes(projectPath).map((r) => ({ route: r }))
    ]
    const seen = new Set<string>()
    return all.filter((o) => !seen.has(o.route) && !!seen.add(o.route))
  }, [design.route, design.name, history.messages, projectPath])
  const goTo = (next: string) => {
    rememberRoute(projectPath, next)
    setRouteDraft(next)
    setCurrent(null)
    setOpening(null)
    onUpdate({ route: next })
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

  const send = async (text: string, files: File[]) => {
    const images = await Promise.all(
      files.filter(isSendableImage).map(async (f) => ({ mediaType: f.type, data: await toBase64(f) }))
    )
    // A primeira mensagem da conversa leva o que fazer: criar a tela do zero, ou ajustar a que já
    // existe. As seguintes, a parte escolhida e o lembrete do endereço. Comando (/compact, /clear...)
    // vai sozinho: com texto junto, o Claude Code não o reconhece como comando.
    const command = text.trimStart().startsWith('/')
    const hint = command
      ? ''
      : sessionId
        ? followHint(here, pick)
        : design.existing
          ? existingHint(design, pick, here)
          : startHint(design)
    sendPrototype({ design, cwd: projectPath, account, text, images, hint })
    // O pedido já foi: a seleção desliga, com ou sem parte escolhida.
    clearPick()
  }

  return (
    <AccountContext.Provider value={account}>
      <section className={`${SIDE} ${viewing ? 'hidden' : ''}`} style={{ width: sideWidth }}>
        {/* A parte escolhida na página; a conversa vem embaixo. */}
        {pick && (
        <div className="shrink-0 border-b border-line px-3 py-2">
            <span className="flex w-fit max-w-full items-center gap-1 rounded-md bg-accent/15 py-0.5 pl-2 pr-1 text-[12px] text-accent">
              <span className="truncate">{pick.section ? `${pick.section} › ${pick.name}` : `Parte: ${pick.name}`}</span>
              <button
                aria-label="Soltar a parte escolhida"
                title="Soltar a parte escolhida"
                onClick={clearPick}
                className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-accent/20"
              >
                <X size={11} />
              </button>
            </span>
        </div>
        )}
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
          />
        </div>
        <SideResizer />
      </section>

      <div className="flex min-w-0 flex-1 flex-col">
        {origin && !viewing && !fresh && (
          <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-1.5">
            {ports.length > 1 ? (
              <select
                value={port}
                onChange={(e) => setPortChoice(Number(e.target.value))}
                className="rounded-md bg-fill px-1.5 py-0.5 text-[12px] text-muted outline-none"
              >
                {ports.map((p) => (
                  <option key={p} value={p}>
                    localhost:{p}
                  </option>
                ))}
              </select>
            ) : (
              <span className="shrink-0 text-[12px] text-faint">localhost:{port}</span>
            )}
            <RouteField value={routeDraft} onChange={setRouteDraft} onGo={goTo} options={routeOptions} />
            <button aria-label="Recarregar a página" title="Recarregar a página" onClick={reloadHere} className={ICON_BUTTON}>
              <RotateCw size={13} />
            </button>
            <button
              onClick={togglePick}
              disabled={!url}
              title="Escolher uma parte da página para mudar (Esc cancela)"
              className={`flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] disabled:opacity-40 ${
                picking ? 'bg-accent text-white' : 'text-muted hover:bg-fill hover:text-text'
              }`}
            >
              <Crosshair size={13} />
              Selecionar
            </button>
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
            // Página recarregada: o seletor que estava ligado volta a ela.
            onLoad={() => {
              if (origin) window.api.design.track(origin)
              if (picking) picker(true)
              if (origin && viewing) window.api.design.escape(origin, true)
            }}
          />
        ) : fresh && start ? (
          <div className="min-h-0 flex-1 overflow-y-auto">{start}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
            {running || server?.state === 'starting' ? (
              <Loader2 size={20} className="animate-spin text-faint" />
            ) : (
              <Code2 size={20} className="text-faint" />
            )}
            <p className={`max-w-sm text-xs leading-relaxed ${server?.error ? 'text-red-400' : 'text-faint'}`}>
              {serverText(server, running)}
            </p>
            {server?.state === 'stopped' && server.error && (
              <button onClick={() => void startProjectServer(projectPath)} className={`${BUTTON} hover:bg-surface-2`}>
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
