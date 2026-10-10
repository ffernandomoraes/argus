import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Design } from '../../../shared/design'
import { useProjectServer } from '../devServers/projectServers'
import { rememberLinks, rememberRoute, routesKey } from './address/knownRoutes'
import { pageApps, type ProjectApp } from './address/projectApps'
import { usePagePort } from './page/usePagePort'

const NO_PORTS: readonly number[] = []

// Endereço da página do protótipo: o servidor do projeto, o app (porta) na tela, o caminho que o
// quadro carrega e onde a pessoa está, e o recarregar. `running`: a conversa trabalhando (no fim de
// cada pedido, a página recarrega).
export function usePrototypeAddress(design: Design, onUpdate: (patch: Partial<Design>) => void, running: boolean) {
  const { projectPath, route } = design
  // O protótipo é visto pelo servidor do projeto. Parado, não sobe sozinho (abrir o design pode ter
  // sido um clique sem querer): o painel mostra o botão de iniciar.
  const server = useProjectServer(projectPath)
  const ports = server?.state === 'running' ? server.ports : NO_PORTS
  // Monorepo: o `dev` sobe vários apps, um por porta. A escolha fica no design.
  const allApps: ProjectApp[] = server?.state === 'running' ? (server.apps ?? ports.map((p) => ({ port: p, dir: '' }))) : []
  // Só os que mostram página entram na escolha; sem escolha, abre o primeiro deles (não a API).
  const apps = pageApps(allApps)
  // Conferindo quais portas mostram página: só segura a primeira abertura (ver page/pagePort.ts).
  const checking = allApps.some((a) => a.page === undefined)
  const choice = design.port ?? null
  const candidate = choice !== null && ports.includes(choice) ? choice : (apps[0]?.port ?? ports[0] ?? null)
  const port = usePagePort({ choice, ports, candidate, checking })
  const app = allApps.find((a) => a.port === port)
  const origin = port ? `http://localhost:${port}` : null
  const rkey = routesKey(projectPath, port ?? undefined)

  // Página que a pessoa está vendo: muda ao navegar dentro dela (a própria página avisa, ver
  // trackInPage). `opening` é o caminho que o quadro carrega e só muda pela pessoa: o endereço
  // digitado, o recarregar. A linha ROTA do Claude só abre a página quando ainda não há nenhuma
  // (protótipo novo); depois, muda o endereço guardado da tela sem tirar a pessoa de onde ela está.
  const [current, setCurrent] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [opening, setOpening] = useState<string | null>(route ?? null)
  if (!opening && route) setOpening(route)
  const here = current ?? opening ?? route
  const url = origin && opening ? origin + opening : null

  // O campo mostra onde a pessoa está (ou o que ela digita), não a ROTA que o Claude informou.
  const [routeDraft, setRouteDraft] = useState(route ?? '')
  const [shownOpening, setShownOpening] = useState(opening)
  if (opening !== shownOpening) {
    setShownOpening(opening)
    if (!current) setRouteDraft(opening ?? '')
  }

  // Recarregar (e o fim de cada pedido) abre de novo a página em que a pessoa está.
  const [reload, setReload] = useState(0)
  const reloadHere = () => {
    if (here) setOpening(here)
    setReload((n) => n + 1)
  }
  const reloadEvent = useEffectEvent(() => reloadHere())
  // ⌘R / Ctrl+R com a página aberta: recarrega ela, não o app.
  useEffect(() => (url ? window.api.onReloadKey(() => reloadEvent()) : undefined), [url])
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running) reloadEvent()
    wasRunning.current = running
  }, [running])

  // A página avisou que navegou (endereço já conferido, ver pageMessages).
  const onLocation = (path: string, title: string) => {
    setPageTitle(title)
    setCurrent(path)
    setRouteDraft(path)
    rememberRoute(rkey, path)
  }
  const onLinks = (paths: string[]) => rememberLinks(rkey, paths)

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
    setCurrent(null)
    setOpening('/')
    setRouteDraft('/')
    onUpdate({ port: next, route: '/' })
    setReload((n) => n + 1)
  }

  return {
    server,
    apps,
    allApps,
    app,
    port,
    checking,
    origin,
    here,
    url,
    pageTitle,
    reload,
    reloadHere,
    routeDraft,
    setRouteDraft,
    goTo,
    switchApp,
    onLocation,
    onLinks
  }
}

export type PrototypeAddress = ReturnType<typeof usePrototypeAddress>
