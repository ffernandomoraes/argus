import { useState, type ReactNode } from 'react'
import { Code2, FileCode2, Loader2, Monitor, Smartphone } from 'lucide-react'
import type { DesignDevice } from '../../../shared/design'
import { useProjectServer } from '../devServers/projectServers'
import { Segmented } from '../settings/controls'
import { Button } from '../ui/Button'
import { useKnownRoutes } from './address/knownRoutes'
import { appLabel, pageApps } from './address/projectApps'
import { RouteField } from './address/RouteField'
import { normalizeRoute } from './address/routeText'
import { ServerStatus } from './ServerStatus'

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

// Design que ainda não começou: protótipo do zero (descrito no chat ao lado) ou uma tela que já existe
// no projeto (aberta pelo endereço, para ajustar).
export function StartChoice({
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
            <Button variant="primary" onClick={() => open(normalizeRoute(route))} disabled={checking}>
              Abrir
            </Button>
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
