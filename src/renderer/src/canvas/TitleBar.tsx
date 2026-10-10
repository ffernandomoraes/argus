import { memo, useEffect, useState } from 'react'
import { AppWindow, Eye, EyeOff } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { NavButton } from '../ui/NavButton'
import { useUpdates } from '../updates/useUpdates'
import { useWindowControls } from '../useWindowControls'
import { UpdateStatus } from './bars/UpdateStatus'
import { updateProgress } from './bars/updateProgress'
import { useNewWindowShortcut } from './bars/useNewWindowShortcut'
import { UsageIndicator } from './UsageIndicator'

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
  const [usageOpen, setUsageOpen] = useState(false)
  const status = updateProgress(updates?.state)
  useNewWindowShortcut()

  // Aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = windowTitle
  }, [windowTitle])

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50). Com o
    // painel de limites aberto sobe acima dos painéis, senão um drawer aberto cobriria o painel.
    // O recuo acompanha o grupo da direita (limites, nova janela e, às vezes, atualizar ao lado da versão) dos dois lados:
    // o título segue no centro sem encostar nele.
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`drag absolute inset-x-0 top-0 ${usageOpen ? 'z-[45]' : 'z-[35]'} flex items-center justify-center gap-2 border-b border-line bg-surface ${status.ready || status.progress ? 'px-[29rem]' : 'px-[19rem]'}`}
    >
      <span className="text-[13px] font-semibold text-muted">Argus</span>
      {/* No pnpm dev, para distinguir do app instalado aberto ao mesmo tempo. */}
      {import.meta.env.DEV && (
        <span className="rounded-full border border-dev/40 bg-dev/10 px-2 py-px text-[11px] font-medium tracking-wide text-dev uppercase">
          Desenvolvimento
        </span>
      )}
      {updates && (
        <div className="absolute inset-y-0 flex items-center gap-2.5" style={{ right: 12 + controls.right }}>
          <UsageIndicator open={usageOpen} onOpenChange={setUsageOpen} />
          <Divider />
          {/* Fora da área que arrasta a janela, senão o botão não recebe o mouse. */}
          <span className="no-drag flex items-center gap-0.5">
            <NavButton
              label={uiHidden ? 'Mostrar interface' : 'Ocultar interface'}
              shortcut={'⌘ \\'}
              compact
              selected={uiHidden}
              side="bottom-end"
              onClick={onToggleUi}
            >
              {uiHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            </NavButton>
            <NavButton label="Nova janela do canvas" shortcut="⇧⌘N" compact side="bottom-end" onClick={() => window.api.canvas.newWindow()}>
              <AppWindow size={14} />
            </NavButton>
          </span>
          <Divider />
          <UpdateStatus version={updates.version} {...status} />
        </div>
      )}
    </div>
  )
})
