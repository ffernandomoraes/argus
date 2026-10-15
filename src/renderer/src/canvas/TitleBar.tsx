import { memo, useEffect } from 'react'
import { AppWindow, Bug, Eye, EyeOff } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { NavButton } from '../ui/NavButton'
import { useUpdates } from '../updates/useUpdates'
import { useWindowControls } from '../useWindowControls'
import { MediaControls } from './bars/MediaControls'
import { UpdateStatus } from './bars/UpdateStatus'
import { updateProgress } from './bars/updateProgress'
import { useNewWindowShortcut } from './bars/useNewWindowShortcut'
import { usePreference } from '../settings/preferences'
import { openReport } from '../report/reportStore'
import { useReportState } from '../report/useReportState'
import { tr } from '../i18n'

const Divider = () => <span className="h-4 w-px bg-line" />

// Barra de título, como a do VS Code: sem a barra do sistema, é ela que guarda os botões da janela
// (os semáforos do Mac à esquerda; minimizar, maximizar e fechar do Windows à direita), arrasta a
// janela e maximiza no duplo clique. Tem fundo próprio, para o título não brigar com o canvas; os
// painéis começam abaixo dela (PANEL_TOP).
// Mostra sempre o nome do app; a conversa aberta fica só no título da janela (windowTitle).
export const TitleBar = memo(function TitleBar({
  windowTitle,
  uiHidden,
  onToggleUi
}: {
  windowTitle: string
  uiHidden: boolean
  onToggleUi: () => void
}) {
  const updates = useUpdates()
  const controls = useWindowControls()
  const mediaPlayer = usePreference('mediaPlayer')
  const status = updateProgress(updates?.state)
  const investigating = useReportState().status === 'running'
  useNewWindowShortcut()

  // Aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = windowTitle
  }, [windowTitle])

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50). Com o
    // mouse em cima sobe acima de todos: os tooltips dos botões abrem para baixo, por cima do drawer.
    // Modal aberto cobre a barra, então o mouse nem chega nela.
    // O recuo acompanha o maior dos lados (o player à esquerda; ocultar, nova janela, reportar
    // problema e, às vezes, atualizar ao lado da versão à direita) dos dois lados: o título segue no
    // centro sem encostar nele. Os limites ficam na barra de baixo (BottomBar).
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`drag absolute inset-x-0 top-0 z-[35] flex items-center justify-center gap-2 border-b border-line bg-surface hover:z-[55] ${status.ready || status.progress || mediaPlayer ? 'px-[22rem]' : 'px-[12rem]'}`}
    >
      {/* Logo depois dos botões da janela (os semáforos do Mac). Desligado, nem consulta o sistema. */}
      {mediaPlayer && (
        <div className="absolute inset-y-0 flex items-center" style={{ left: 12 + controls.left }}>
          <MediaControls />
        </div>
      )}
      <span className="text-[13px] font-semibold text-muted">Argus</span>
      {/* No pnpm dev, para distinguir do app instalado aberto ao mesmo tempo. */}
      {import.meta.env.DEV && (
        <span className="rounded-full border border-dev/40 bg-dev/10 px-2 py-px text-[11px] font-medium tracking-wide text-dev uppercase">
          {tr('Desenvolvimento', 'Development')}
        </span>
      )}
      {updates && (
        <div className="absolute inset-y-0 flex items-center gap-2.5" style={{ right: 12 + controls.right }}>
          {/* Fora da área que arrasta a janela, senão o botão não recebe o mouse. */}
          <span className="no-drag flex items-center gap-0.5">
            <NavButton
              label={uiHidden ? tr('Mostrar interface', 'Show interface') : tr('Ocultar interface', 'Hide interface')}
              shortcut={'⌘ \\'}
              compact
              selected={uiHidden}
              side="bottom-end"
              onClick={onToggleUi}
            >
              {uiHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </NavButton>
            <NavButton label={tr('Nova janela do canvas', 'New canvas window')} shortcut="⇧⌘N" compact side="bottom-end" onClick={() => window.api.canvas.newWindow()}>
              <AppWindow size={14} />
            </NavButton>
            {/* Ligado enquanto o Claude investiga, para achar o caminho de volta ao relatório. */}
            <NavButton
              label={investigating ? tr('Investigando o problema', 'Investigating the problem') : tr('Reportar problema', 'Report a problem')}
              compact
              selected={investigating}
              side="bottom-end"
              onClick={() => openReport()}
            >
              <Bug size={14} />
            </NavButton>
          </span>
          <Divider />
          <UpdateStatus version={updates.version} {...status} />
        </div>
      )}
    </div>
  )
})
