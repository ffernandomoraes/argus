import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronRight, Ellipsis, ExternalLink, Loader2, Lock, LogOut, Power, RotateCw, Trash2 } from 'lucide-react'
import { REMOVABLE_SCOPES, type McpAuthResult, type McpServer, type McpStatus } from '../../../shared/mcp'
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog'
import { ContextMenu, type MenuItem } from '../canvas/ContextMenu'
import { useAnchoredMenu } from '../ui/useAnchoredMenu'
import { serverLabel } from './serverLabel'
import { tr } from '../i18n'

// De onde vêm os servidores: a sessão de uma conversa (painel do /mcp) ou o `claude` de uma conta
// (aba MCP das configurações). wait: a primeira consulta, que pode esperar todos conectarem.
export type McpSource = {
  status: (wait: boolean) => Promise<McpStatus>
  reconnect: (name: string) => Promise<McpStatus>
  authenticate: (name: string) => Promise<McpAuthResult>
  clearAuth: (name: string) => Promise<McpStatus>
  remove: (name: string, scope: string) => Promise<McpStatus>
}

// Como cada estado aparece. A ordem aqui é a ordem das seções na lista.
const GROUPS = [
  { status: 'connected', label: tr('Conectados', 'Connected'), icon: Check, tone: 'text-emerald-400' },
  { status: 'needs-auth', label: tr('Precisam de autorização', 'Need authorization'), icon: Lock, tone: 'text-needs-you' },
  { status: 'failed', label: tr('Com erro', 'Failed'), icon: AlertTriangle, tone: 'text-red-400' },
  { status: 'pending', label: tr('Conectando', 'Connecting'), icon: Loader2, tone: 'text-running' },
  { status: 'disabled', label: tr('Desligados', 'Disabled'), icon: Power, tone: 'text-faint' }
] as const

const HINT: Partial<Record<McpServer['status'], string>> = {
  'needs-auth': tr(
    'Clique em Autorizar: o navegador abre na página do serviço e, ao terminar lá, ele conecta sozinho.',
    'Click Authorize: the browser opens the service’s page and, once you finish there, it connects on its own.'
  ),
  failed: tr('O Claude não conseguiu conectar. Veja o erro de cada um abaixo.', 'Claude couldn’t connect. See each error below.')
}

// Enquanto algum servidor conecta (ou espera o navegador), a lista pergunta de novo neste intervalo.
const POLL_MS = 1000

const failure = (err: unknown): McpStatus => ({ ok: false, error: err instanceof Error ? err.message : String(err) })

// Estado da lista e as ações de cada servidor. `source` precisa ser estável (useMemo de quem chama):
// trocar de fonte pergunta de novo.
export function useMcpServers(source: McpSource) {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [loading, setLoading] = useState(true)
  // Servidores reconectando agora (pelo botão de cada um).
  const [reconnecting, setReconnecting] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  // Servidores com o link de autorização aberto no navegador. O valor: conector do claude.ai, que é
  // preciso reconectar ao voltar para o app (o site não avisa o Claude).
  const [authorizing, setAuthorizing] = useState<ReadonlyMap<string, boolean>>(new Map())

  // Removidos agora: a sessão aberta da conversa ainda os vê até reabrir, então somem daqui.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())

  const fetchStatus = useCallback((wait: boolean) => source.status(wait).catch(failure), [source])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setStatus(null)
    setAuthorizing(new Map())
    setRemoved(new Set())
    void fetchStatus(true).then((s) => {
      if (!alive) return
      setStatus(s)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [fetchStatus])

  const refresh = () => {
    setLoading(true)
    void fetchStatus(true).then((s) => {
      setStatus(s)
      setLoading(false)
    })
  }

  const servers = status?.ok ? status.servers.filter((s) => !removed.has(s.name)) : []
  const live = status?.ok === true && status.live

  // Com o `claude` aberto, a lista vem na hora; enquanto alguém conecta, pergunta de novo sozinha.
  const connecting = live && (reconnecting.size > 0 || authorizing.size > 0 || servers.some((x) => x.status === 'pending'))
  useEffect(() => {
    if (!connecting) return
    const timer = setTimeout(() => void fetchStatus(false).then(setStatus), POLL_MS)
    return () => clearTimeout(timer)
  }, [connecting, status, fetchStatus])

  // Saiu de "precisa de autorização" (conectou ou deu erro): para de esperar o navegador.
  useEffect(() => {
    if (!authorizing.size) return
    const done = [...authorizing.keys()].filter((name) => servers.find((x) => x.name === name)?.status !== 'needs-auth')
    if (!done.length) return
    setAuthorizing((a) => {
      const next = new Map(a)
      for (const name of done) next.delete(name)
      return next
    })
  }, [servers, authorizing])

  const run = (name: string, action: Promise<McpStatus>) => {
    setActionError(null)
    setReconnecting((r) => new Set(r).add(name))
    void action
      .catch(failure)
      .then((s) => (s.ok ? setStatus(s) : setActionError(s.error)))
      .finally(() =>
        setReconnecting((r) => {
          const next = new Set(r)
          next.delete(name)
          return next
        })
      )
  }

  const reconnect = (name: string) => run(name, source.reconnect(name))
  const signOut = (name: string) => run(name, source.clearAuth(name))
  const remove = (name: string, scope: string) =>
    run(
      name,
      source.remove(name, scope).then((s) => {
        if (s.ok) setRemoved((r) => new Set(r).add(name))
        return s
      })
    )

  const authorize = (name: string) => {
    setActionError(null)
    void source.authenticate(name).then(
      (r) => (r.ok ? setAuthorizing((a) => new Map(a).set(name, r.manualReconnect)) : setActionError(r.error)),
      (err: unknown) => setActionError(err instanceof Error ? err.message : String(err))
    )
  }

  // De volta ao app depois de autorizar um conector do claude.ai no site: reconecta para ele valer.
  useEffect(() => {
    const manual = [...authorizing].filter(([, m]) => m).map(([name]) => name)
    if (!manual.length) return
    const onFocus = () => manual.forEach((name) => reconnect(name))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  })

  return { status, servers, live, loading, refresh, reconnecting, authorizing, actionError, reconnect, authorize, signOut, remove }
}

// Página dos conectores no claude.ai; abre no navegador (ver main/app/navigation.ts).
const CONNECTORS_URL = 'https://claude.ai/settings/connectors'
const openConnectors = () => void window.open(CONNECTORS_URL, '_blank')

type Actions = { onReconnect?: () => void; onAuthorize?: () => void; onSignOut?: () => void; onRemove?: () => void }

// Sem as ações: o `claude` não está aberto (conversa que ainda não mandou nada).
// authorizing: o link já abriu no navegador e a lista espera a autorização terminar.
// Na linha fica só o que é a vez do servidor (Autorizar, ou o que está acontecendo agora); o resto
// vai no menu dos três pontinhos, que com tudo à vista a linha pesava.
function ServerRow({ server, reconnecting, authorizing, onReconnect, onAuthorize, onSignOut, onRemove }: {
  server: McpServer
  reconnecting: boolean
  authorizing: boolean
} & Actions) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const menu = useAnchoredMenu(anchorRef)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const needsAuth = server.status === 'needs-auth'
  const label = serverLabel(server)
  const tools = server.tools === 1 ? tr('1 ferramenta', '1 tool') : server.tools > 1 ? tr(`${server.tools} ferramentas`, `${server.tools} tools`) : null
  const meta = [label.origin, tools].filter(Boolean).join(' - ')

  const items: MenuItem[] = []
  if (onReconnect && server.status !== 'disabled' && !needsAuth)
    items.push({ type: 'action', label: tr('Reconectar', 'Reconnect'), icon: RotateCw, onSelect: onReconnect })
  if (onSignOut && server.signOut && server.status === 'connected')
    items.push({ type: 'action', label: tr('Desconectar', 'Sign out'), icon: LogOut, onSelect: onSignOut })
  if (onRemove && server.scope === 'claudeai') {
    // O Claude Code não apaga conector do claude.ai: o site abre na página deles.
    if (items.length) items.push({ type: 'separator' })
    items.push({ type: 'action', label: tr('Remover no claude.ai', 'Remove on claude.ai'), icon: ExternalLink, onSelect: openConnectors })
  } else if (onRemove && (REMOVABLE_SCOPES.includes(server.scope ?? '') || server.source === 'plugin')) {
    if (items.length) items.push({ type: 'separator' })
    items.push({ type: 'action', label: tr('Remover', 'Remove'), icon: Trash2, danger: true, onSelect: onRemove })
  }

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
      {/* Nome em cima; embaixo, menor, de onde veio e quantas ferramentas tem; o erro por último. */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-text" title={server.name}>
          {label.name}
        </div>
        {meta && <div className="truncate text-[15px] text-faint">{meta}</div>}
        {server.error && <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-muted">{server.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {reconnecting ? (
          <span className="flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[15px] text-muted">
            <Loader2 size={11} className="animate-spin" />
            {tr('Aguarde…', 'Please wait…')}
          </span>
        ) : (
          onAuthorize &&
          needsAuth && (
            <button
              onClick={onAuthorize}
              title={authorizing ? tr('Abre a página de autorização de novo', 'Opens the authorization page again') : undefined}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[15px] text-muted hover:bg-fill hover:text-text"
            >
              {authorizing ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
              {authorizing ? tr('Esperando o navegador…', 'Waiting for the browser…') : tr('Autorizar', 'Authorize')}
            </button>
          )
        )}
        {items.length > 0 && (
          <button
            ref={anchorRef}
            aria-label={tr(`Opções de ${label.name}`, `${label.name} options`)}
            aria-haspopup="menu"
            aria-expanded={menu.open}
            disabled={reconnecting}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setPos({ x: r.left, y: r.bottom + 4 })
              menu.toggle()
            }}
            className={`flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-fill hover:text-text disabled:opacity-40 ${menu.open ? 'bg-fill text-text' : ''}`}
          >
            <Ellipsis size={18} />
          </button>
        )}
      </div>
      {/* No body: dentro da área que rola, o menu seria cortado. */}
      {menu.open && pos && createPortal(<ContextMenu menu={{ ...pos, items }} onClose={menu.close} />, document.body)}
    </li>
  )
}

// "plugin:vercel:vercel" → "vercel".
const pluginOf = (server: McpServer) => server.name.match(/^plugin:([^:]+):/)?.[1] ?? server.name

// A lista agrupada por estado, com as mensagens de carregando, erro e lista vazia.
// notLive: o aviso de quando o `claude` não está aberto e não dá para agir.
export function McpServerList({ state, empty, notLive }: { state: ReturnType<typeof useMcpServers>; empty: string; notLive?: string }) {
  const { status, servers, live, loading } = state
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  // Grupos abertos. Começa só com os conectados: os outros (erro, autorização, conectando,
  // desligados) ficam fechados, com o número à vista, até alguém abrir.
  const [open, setOpen] = useState<ReadonlySet<McpServer['status']>>(new Set(['connected']))
  const toggle = (s: McpServer['status']) =>
    setOpen((o) => {
      const next = new Set(o)
      if (!next.delete(s)) next.add(s)
      return next
    })

  const askSignOut = (server: McpServer) =>
    setConfirm({
      title: tr(`Desconectar ${serverLabel(server).name}?`, `Sign out of ${serverLabel(server).name}?`),
      description: tr(
        'O login dele sai desta conta do Claude, em todas as conversas. Para usar de novo, é só autorizar outra vez.',
        'Its login is removed from this Claude account, in every chat. To use it again, just authorize it again.'
      ),
      confirmLabel: tr('Desconectar', 'Sign out'),
      onConfirm: () => state.signOut(server.name)
    })

  // Os de projeto ficam no .mcp.json da pasta, que costuma ir para o git: valem para todo mundo.
  const askRemove = (server: McpServer) =>
    setConfirm({
      title: tr(`Remover ${serverLabel(server).name}?`, `Remove ${serverLabel(server).name}?`),
      description:
        server.source === 'plugin'
          ? tr(
              `Ele vem do plugin ${pluginOf(server)}: o plugin inteiro é desinstalado, com o que mais ele traz (skills, comandos, agentes). Para voltar, é preciso instalar de novo.`,
              `It comes from the ${pluginOf(server)} plugin: the whole plugin is uninstalled, along with whatever else it brings (skills, commands, agents). To bring it back, install it again.`
            )
          : server.scope === 'project'
          ? tr(
              'Ele sai do .mcp.json desta pasta, e some para todo mundo que usa o projeto. Para voltar, é preciso adicionar de novo.',
              'It’s removed from this folder’s .mcp.json, for everyone who uses the project. To bring it back, add it again.'
            )
          : tr(
              'Ele sai da configuração desta conta do Claude. Conversas já abertas ainda o usam até reabrir. Para voltar, é preciso adicionar de novo.',
              'It’s removed from this Claude account’s settings. Chats already open keep it until they reopen. To bring it back, add it again.'
            ),
      confirmLabel: tr('Remover', 'Remove'),
      onConfirm: () => state.remove(server.name, server.scope ?? '')
    })

  return (
    <>
      {loading && servers.length === 0 && (
        <p className="flex items-center justify-center gap-2 py-8 text-[15px] text-faint">
          <Loader2 size={13} className="animate-spin" />
          {tr('Perguntando aos servidores…', 'Asking the servers…')}
        </p>
      )}
      {status && !status.ok && <p className="px-2 py-4 text-[15px] text-red-400">{status.error}</p>}
      {state.actionError && <p className="px-2 pb-3 text-[15px] text-red-400">{state.actionError}</p>}
      {status?.ok && !live && servers.length > 0 && notLive && <p className="mb-3 px-2 text-[15px] leading-snug text-faint">{notLive}</p>}
      {status?.ok && servers.length === 0 && !loading && <p className="px-2 py-4 text-[15px] text-faint">{empty}</p>}
      {GROUPS.map(({ status: s, label, icon: Icon, tone }) => {
        // Pelo nome que aparece: sem o prefixo, os do claude.ai e os de plugin se misturam aos outros.
        const list = servers.filter((x) => x.status === s).sort((a, b) => serverLabel(a).name.localeCompare(serverLabel(b).name))
        if (!list.length) return null
        const expanded = open.has(s)
        return (
          <section key={s} className="mb-2 last:mb-0">
            <button
              onClick={() => toggle(s)}
              aria-expanded={expanded}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-2"
            >
              <Icon size={12} className={`shrink-0 ${tone} ${s === 'pending' ? 'animate-spin' : ''}`} />
              <span className="text-[15px] font-medium uppercase tracking-wide text-muted">{label}</span>
              <span className="text-[15px] text-faint">{list.length}</span>
              <ChevronRight size={14} className={`ml-auto shrink-0 text-faint transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            {expanded && HINT[s] && <p className="mb-1 px-2 text-[15px] leading-snug text-faint">{HINT[s]}</p>}
            <ul className={`mb-2 flex flex-col ${expanded ? '' : 'hidden'}`}>
              {list.map((server) => (
                <ServerRow
                  key={server.name}
                  server={server}
                  reconnecting={state.reconnecting.has(server.name)}
                  authorizing={state.authorizing.has(server.name)}
                  {...(live && {
                    onReconnect: () => state.reconnect(server.name),
                    onAuthorize: () => state.authorize(server.name),
                    onSignOut: () => askSignOut(server)
                  })}
                  // Remover não precisa do `claude` aberto: é pelo comando dele.
                  onRemove={() => askRemove(server)}
                />
              ))}
            </ul>
          </section>
        )
      })}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  )
}
