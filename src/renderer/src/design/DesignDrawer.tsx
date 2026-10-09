import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Code2, FileCode2, Folder, Loader2, Monitor, PenTool, Play, Smartphone, X } from 'lucide-react'
import { DESIGN_VERSION, type Design, type DesignDevice } from '../../../shared/design'
import { HeaderButton } from '../conversation/ConversationView'
import { PANEL_MARGIN, PANEL_TOP } from '../conversation/FloatingPanel'
import { startProjectServer, useProjectServer } from '../devServers/projectServers'
import { BUTTON, Segmented } from '../settings/controls'
import { useEscape } from '../useEscape'
import { PrototypePane } from './PrototypePane'
import { appLabel, normalizeRoute, pageApps, rememberRoute, RouteField, routesKey, useKnownRoutes } from './RouteField'

const SECONDARY = `${BUTTON} shrink-0 hover:bg-surface-2`

// Design aberto no drawer: um dos designs da pasta (designId novo = design novo).
export type DesignTarget = { designId: string; projectPath: string; projectName: string }

type StartKind = 'new' | 'existing'

function Choice({
  active,
  disabled,
  icon,
  title,
  text,
  onClick
}: {
  active: boolean
  disabled?: boolean
  icon: ReactNode
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-surface enabled:hover:bg-surface-2'
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-accent' : 'text-text'}`}>
        {icon}
        {title}
      </span>
      <span className="text-xs leading-relaxed text-faint">{text}</span>
    </button>
  )
}

// O servidor do projeto à vista, com o botão de iniciar quando está parado: a página só aparece com
// ele rodando.
function ServerStatus({ projectPath }: { projectPath: string }) {
  const server = useProjectServer(projectPath)
  if (!server) return <p className="text-[12px] text-faint">Conferindo o servidor do projeto…</p>
  if (server.state === 'running')
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
        Servidor rodando: {(server.apps?.length ? server.apps.map(appLabel) : server.ports.map((p) => `localhost:${p}`)).join(', ')}
      </p>
    )
  if (server.state === 'starting')
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <Loader2 size={12} className="shrink-0 animate-spin" />
        Iniciando o servidor ({server.command})…
      </p>
    )
  if (!server.script)
    return <p className="text-[12px] text-red-400">Esta pasta não tem script dev ou start para mostrar a página.</p>
  return (
    <div className="flex w-full items-center justify-center gap-2">
      <p className={`min-w-0 truncate text-[12px] ${server.error ? 'text-red-400' : 'text-muted'}`} title={server.error}>
        {server.error ? `O servidor não subiu: ${server.error}` : 'O servidor do projeto está parado.'}
      </p>
      <button
        onClick={() => void startProjectServer(projectPath, true)}
        title={server.command ?? undefined}
        className={`${SECONDARY} flex shrink-0 items-center gap-1.5`}
      >
        <Play size={11} />
        {server.error ? 'Tentar de novo' : 'Iniciar o servidor'}
      </button>
    </div>
  )
}

// Design que ainda não começou: protótipo do zero (descrito no chat ao lado) ou uma tela que já existe
// no projeto (aberta pelo endereço, para ajustar).
function StartChoice({
  projectPath,
  projectName,
  device,
  onDevice,
  onOpenExisting
}: {
  projectPath: string
  projectName: string
  device: DesignDevice
  onDevice: (device: DesignDevice) => void
  onOpenExisting: (route: string, port?: number) => void
}) {
  const [kind, setKind] = useState<StartKind>('new')
  const [route, setRoute] = useState('')
  const server = useProjectServer(projectPath)
  // Monorepo: o `dev` sobe vários apps (site, admin, app); a tela é de um deles.
  const running = server?.state === 'running' ? (server.apps ?? []) : []
  const apps = pageApps(running)
  // Até saber quais portas mostram página, sem escolha nem Abrir: a primeira porta pode ser a API.
  const checking = running.some((a) => a.page === undefined)
  const [port, setPort] = useState<number | null>(null)
  const app = apps.find((a) => a.port === port) ?? apps[0]
  const routes = useKnownRoutes(projectPath, app)
  const open = (r: string) => !checking && onOpenExisting(r, app?.port)
  const noScript = !!server && server.state === 'stopped' && !server.script
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-14">
      <p className="text-sm font-medium text-text">O que você quer fazer?</p>
      <div className="grid w-full grid-cols-2 gap-3">
        <Choice
          active={kind === 'new'}
          icon={<Code2 size={15} />}
          title="Protótipo novo"
          text={`Uma tela nova em código de verdade em ${projectName}, com as tecnologias do projeto.`}
          onClick={() => setKind('new')}
        />
        <Choice
          active={kind === 'existing'}
          disabled={noScript}
          icon={<FileCode2 size={15} />}
          title="Tela que já existe"
          text={noScript ? 'Esta pasta não tem script dev ou start para mostrar a página.' : 'Abre uma página do projeto para ajustar direto no código.'}
          onClick={() => setKind('existing')}
        />
      </div>
      <Segmented
        value={device}
        onChange={onDevice}
        options={[
          { value: 'desktop', label: 'Desktop', icon: <Monitor size={12} /> },
          { value: 'mobile', label: 'Celular', icon: <Smartphone size={12} /> }
        ]}
      />
      {kind === 'existing' ? (
        <>
          <ServerStatus projectPath={projectPath} />
          {checking && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <Loader2 size={12} className="shrink-0 animate-spin" />
              Conferindo quais portas mostram página…
            </p>
          )}
          {!checking && apps.length > 1 && app && (
            <div className="flex max-w-full flex-col items-center gap-1.5">
              <p className="text-[12px] text-muted">Qual app você quer ajustar?</p>
              <div className="max-w-full overflow-x-auto">
                <Segmented
                  value={String(app.port)}
                  onChange={(v) => setPort(Number(v))}
                  options={apps.map((a) => ({ value: String(a.port), label: appLabel(a) }))}
                />
              </div>
            </div>
          )}
          <div className="flex w-full max-w-md items-center gap-2">
            <RouteField value={route} onChange={setRoute} onGo={open} options={routes} />
            <button
              onClick={() => open(normalizeRoute(route))}
              disabled={checking}
              className="flex h-6 shrink-0 items-center rounded-md bg-accent px-3 text-[12px] font-medium text-white enabled:hover:brightness-110 disabled:opacity-40"
            >
              Abrir
            </button>
          </div>
          <p className="text-center text-xs leading-relaxed text-faint">
            Escreva o endereço da página (por exemplo, /produtos) ou deixe vazio para abrir a página inicial. Ela abre aqui, e
            cada pedido no chat muda o código dela.
          </p>
        </>
      ) : (
        <p className="text-center text-xs leading-relaxed text-faint">
          Descreva a tela no chat ao lado. Uma conversa do Claude Code escreve a tela no projeto, e a página aparece aqui pelo
          servidor dele.
        </p>
      )}
    </div>
  )
}

// Drawer do modo design: o canvas inteiro, com uma margem para ainda se ver o canvas. À esquerda, a
// conversa do protótipo; à direita, a página. Uma barra só em cima: o nome, a largura da página
// (desktop ou celular) e fechar. Visualizar fica na barra de endereço da página.
export function DesignDrawer({
  target,
  account,
  tint,
  onClose
}: {
  target: DesignTarget
  account?: string
  // Cor do grupo de onde o design abriu; o painel puxa esse tom de leve, como o da conversa.
  tint?: string
  onClose: () => void
}) {
  const { designId, projectPath, projectName } = target
  // Design novo fica só aqui até começar (primeiro pedido ou tela aberta): não entra na lista vazio.
  const [design, setDesign] = useState<Design | null>(null)
  const designRef = useRef<Design | null>(null)
  designRef.current = design
  useEffect(() => {
    let alive = true
    void window.api.design.load(designId).then((saved) => {
      if (!alive) return
      const now = new Date().toISOString()
      setDesign(
        saved ?? {
          version: DESIGN_VERSION,
          id: designId,
          name: 'Novo protótipo',
          projectPath,
          device: 'desktop',
          createdAt: now,
          updatedAt: now
        }
      )
    })
    return () => {
      alive = false
    }
  }, [designId, projectPath])

  const update = (patch: Partial<Design>) => {
    const current = designRef.current
    if (!current) return
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
    designRef.current = next
    setDesign(next)
    if (next.sessionId || next.existing) void window.api.design.save(next)
  }

  useEscape(onClose)

  const started = !!design && (!!design.sessionId || !!design.existing || !!design.route)
  // Ver a página em outra largura sem mudar o dispositivo do design.
  const [deviceView, setDeviceView] = useState<DesignDevice | null>(null)
  const shownDevice: DesignDevice = deviceView ?? design?.device ?? 'desktop'

  // Visualizar: o chat e a barra somem, e a página ocupa o drawer todo.
  const [viewing, setViewing] = useState(false)
  useEscape(() => setViewing(false), viewing)

  return (
    <aside
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl shadow-black/50"
      style={{
        left: PANEL_MARGIN,
        right: PANEL_MARGIN,
        top: PANEL_TOP,
        bottom: PANEL_MARGIN,
        ...(tint && { background: `color-mix(in srgb, ${tint} 3%, var(--color-bg))` })
      }}
    >
      {viewing ? (
        // Na altura da barra de endereço da página, à direita dela.
        <div className="absolute right-2 top-1 z-30 flex items-center gap-1.5 opacity-60 hover:opacity-100">
          <div className="flex rounded-full bg-black/55 p-0.5 shadow-lg backdrop-blur">
            {(['desktop', 'mobile'] as const).map((dv) => (
              <button
                key={dv}
                onClick={() => setDeviceView(dv)}
                title={dv === 'desktop' ? 'Ver no desktop' : 'Ver no celular'}
                aria-label={dv === 'desktop' ? 'Ver no desktop' : 'Ver no celular'}
                aria-pressed={shownDevice === dv}
                className={`grid size-6 place-items-center rounded-full text-white ${shownDevice === dv ? 'bg-white/25' : 'hover:bg-white/10'}`}
              >
                {dv === 'desktop' ? <Monitor size={13} /> : <Smartphone size={13} />}
              </button>
            ))}
          </div>
          <button
            onClick={() => setViewing(false)}
            title="Sair da visualização (Esc)"
            aria-label="Sair da visualização"
            className="grid size-7 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className="no-drag nodrag grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line px-3"
          style={
            tint
              ? {
                  background: `color-mix(in srgb, ${tint} 8%, var(--color-bg))`,
                  borderBottomColor: `color-mix(in srgb, ${tint} 25%, var(--color-line))`
                }
              : undefined
          }
        >
          <div className="flex min-w-0 items-center gap-2 justify-self-start">
            <PenTool size={13} className="shrink-0 text-muted" />
            <span className="truncate text-[13px] font-medium">{design?.name ?? 'Design'}</span>
            <span className="flex min-w-0 items-center gap-1 text-[12px] text-faint" title={`Projeto ${projectName}`}>
              <Folder size={12} className="shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          </div>

          <Segmented
            value={shownDevice}
            onChange={setDeviceView}
            options={[
              { value: 'desktop', label: 'Desktop', icon: <Monitor size={12} />, disabled: !started, title: started ? undefined : 'Comece o protótipo primeiro' },
              { value: 'mobile', label: 'Celular', icon: <Smartphone size={12} />, disabled: !started, title: started ? undefined : 'Comece o protótipo primeiro' }
            ]}
          />

          <div className="flex min-w-0 items-center justify-self-end gap-1">
            <HeaderButton label="Fechar" onClick={onClose}>
              <X size={15} />
            </HeaderButton>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {design && (
          <PrototypePane
            design={design}
            account={account}
            onUpdate={update}
            device={shownDevice}
            viewing={viewing}
            onViewing={() => setViewing((v) => !v)}
            start={
              <StartChoice
                projectPath={projectPath}
                projectName={projectName}
                device={design.device}
                onDevice={(device) => update({ device })}
                onOpenExisting={(route, port) => {
                  rememberRoute(routesKey(projectPath, port), route)
                  update({ existing: true, route, name: route, ...(port && { port }) })
                }}
              />
            }
          />
        )}
      </div>
    </aside>
  )
}
