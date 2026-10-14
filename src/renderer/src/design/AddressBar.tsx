import { useMemo } from 'react'
import { ExternalLink, Eye, Minus, Plus, RotateCw } from 'lucide-react'
import type { Design } from '../../../shared/design'
import type { Message } from '../conversation/types'
import { keys } from '../platform'
import { IconButton } from '../ui/IconButton'
import { dedupe, useKnownRoutes } from './address/knownRoutes'
import { appLabel } from './address/projectApps'
import { RouteField } from './address/RouteField'
import { routesIn } from './prototype/appLines'
import type { PreviewZoom } from './usePreviewZoom'
import type { PrototypeAddress } from './usePrototypeAddress'
import { tr } from '../i18n'

// Barra de endereço da página: o app (num monorepo), o caminho, o zoom, recarregar, visualizar e abrir no
// navegador. Também em Visualizar, com folga à direita para os botões dela.
export function AddressBar({
  design,
  address,
  zoom,
  messages,
  viewing,
  onViewing
}: {
  design: Design
  address: PrototypeAddress
  // Só com a página na tela.
  zoom?: PreviewZoom
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
    ...said.map((r) => ({ route: r, name: tr('do Claude', 'from Claude') })),
    ...known
  ])

  return (
    <div className={`flex shrink-0 items-center gap-1.5 border-b border-line py-1.5 pl-3 ${viewing ? 'pr-28' : 'pr-3'}`}>
      {apps.length > 1 ? (
        <select
          value={port ?? undefined}
          onChange={(e) => address.switchApp(Number(e.target.value))}
          title={tr('App do projeto (o comando dev sobe vários)', 'Project app (the dev command starts several)')}
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
      {zoom && (
        <div className="flex shrink-0 items-center">
          <IconButton label={`${tr('Diminuir zoom', 'Zoom out')} (${keys('⌘-')})`} variant="subtle" size="sm" onClick={() => zoom.step(-1)}>
            <Minus size={13} />
          </IconButton>
          <button
            type="button"
            onClick={() => zoom.step(0)}
            title={zoom.fitting ? tr('Ajustado à largura', 'Fit to width') : `${tr('Ajustar à largura', 'Fit to width')} (${keys('⌘0')})`}
            className={`h-6 w-11 rounded-md text-[12px] tabular-nums hover:bg-fill ${zoom.fitting ? 'text-faint' : 'text-text'}`}
          >
            {Math.round(zoom.scale * 100)}%
          </button>
          <IconButton label={`${tr('Aumentar zoom', 'Zoom in')} (${keys('⌘+')})`} variant="subtle" size="sm" onClick={() => zoom.step(1)}>
            <Plus size={13} />
          </IconButton>
        </div>
      )}
      <IconButton label={tr('Recarregar a página', 'Reload page')} variant="subtle" size="sm" onClick={address.reloadHere}>
        <RotateCw size={13} />
      </IconButton>
      {onViewing && (
        <IconButton
          label={tr('Visualizar', 'Preview')}
          title={viewing ? tr('Voltar ao chat (Esc)', 'Back to chat (Esc)') : tr('Visualizar: ver só a página, sem o chat', 'Preview: see only the page, without the chat')}
          variant="subtle"
          size="sm"
          pressed={viewing}
          onClick={onViewing}
        >
          <Eye size={13} />
        </IconButton>
      )}
      {url && (
        <IconButton label={tr('Abrir no navegador', 'Open in browser')} variant="subtle" size="sm" onClick={() => window.open(origin && here ? origin + here : url)}>
          <ExternalLink size={13} />
        </IconButton>
      )}
    </div>
  )
}
