import { useState } from 'react'
import type { DesignDevice } from '../../../shared/design'
import { PANEL_MARGIN, PANEL_TOP } from '../conversation/FloatingPanel'
import { useEscape } from '../useEscape'
import { rememberRoute, routesKey } from './address/knownRoutes'
import { DesignHeader } from './DesignHeader'
import { PrototypePane } from './PrototypePane'
import { StartChoice } from './StartChoice'
import { useDesign } from './useDesign'
import { ViewingControls } from './ViewingControls'

// Design aberto no drawer: um dos designs da pasta (designId novo = design novo).
export type DesignTarget = { designId: string; projectPath: string; projectName: string }

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
  const { design, update } = useDesign(designId, projectPath)
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
        <ViewingControls device={shownDevice} onDevice={setDeviceView} onExit={() => setViewing(false)} />
      ) : (
        <DesignHeader
          name={design?.name}
          projectName={projectName}
          device={shownDevice}
          started={started}
          tint={tint}
          onDevice={setDeviceView}
          onClose={onClose}
        />
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
