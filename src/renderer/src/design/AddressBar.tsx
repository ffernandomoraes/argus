import { useMemo } from 'react'
import { ExternalLink, Eye, RotateCw } from 'lucide-react'
import type { Design } from '../../../shared/design'
import type { Message } from '../conversation/types'
import { IconButton } from '../ui/IconButton'
import { dedupe, useKnownRoutes } from './address/knownRoutes'
import { appLabel } from './address/projectApps'
import { RouteField } from './address/RouteField'
import { routesIn } from './prototype/appLines'
import type { PrototypeAddress } from './usePrototypeAddress'

// Barra de endereço da página: o app (num monorepo), o caminho, recarregar, visualizar e abrir no
// navegador. Também em Visualizar, com folga à direita para os botões dela.
export function AddressBar({
  design,
  address,
  messages,
  viewing,
  onViewing
}: {
  design: Design
  address: PrototypeAddress
  // A conversa do protótipo: as rotas que o Claude informou nela entram na lista do campo.
  messages: Message[]
  viewing: boolean
  onViewing?: () => void
}) {
  const { apps, allApps, app, port, url, origin, here } = address

  // Lista do campo de endereço: o da tela, as rotas que o Claude informou nesta conversa e as já
  // abertas no projeto (enquanto o app está aberto).
  const known = useKnownRoutes(design.projectPath, app)
  const said = useMemo(
    () =>
      routesIn(
        messages
          .filter((m) => m.role === 'assistant')
          .map((m) => m.text)
          .join('\n')
      ),
    [messages]
  )
  const options = dedupe([
    ...(design.route ? [{ route: design.route, name: design.name }] : []),
    ...said.map((r) => ({ route: r, name: 'do Claude' })),
    ...known
  ])

  return (
    <div className={`flex shrink-0 items-center gap-1.5 border-b border-line py-1.5 pl-3 ${viewing ? 'pr-28' : 'pr-3'}`}>
      {apps.length > 1 ? (
        <select
          value={port ?? undefined}
          onChange={(e) => address.switchApp(Number(e.target.value))}
          title="App do projeto (o comando dev sobe vários)"
          className="h-6 max-w-40 shrink-0 rounded-md bg-fill px-1.5 text-[12px] text-text outline-none"
        >
          {allApps
            .filter((a) => apps.includes(a) || a.port === port)
            .map((a) => (
              <option key={a.port} value={a.port}>
                {appLabel(a)}
              </option>
            ))}
        </select>
      ) : (
        <span className="shrink-0 text-[12px] text-faint">{app ? appLabel(app) : `localhost:${port}`}</span>
      )}
      <RouteField value={address.routeDraft} onChange={address.setRouteDraft} onGo={address.goTo} options={options} />
      <IconButton label="Recarregar a página" variant="subtle" size="sm" onClick={address.reloadHere}>
        <RotateCw size={13} />
      </IconButton>
      {onViewing && (
        <IconButton
          label="Visualizar"
          title={viewing ? 'Voltar ao chat (Esc)' : 'Visualizar: ver só a página, sem o chat'}
          variant="subtle"
          size="sm"
          pressed={viewing}
          onClick={onViewing}
        >
          <Eye size={13} />
        </IconButton>
      )}
      {url && (
        <IconButton label="Abrir no navegador" variant="subtle" size="sm" onClick={() => window.open(origin && here ? origin + here : url)}>
          <ExternalLink size={13} />
        </IconButton>
      )}
    </div>
  )
}
