import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppWindow, CircleArrowUp, Coffee, Eye, EyeOff } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { useUpdates } from '../updates/useUpdates'
import { IS_WIN } from '../platform'
import { useWindowControls } from '../useWindowControls'
import { CoffeeDialog } from './CoffeeDialog'
import { NavButton } from './NavBar'

const Divider = () => <span className="h-4 w-px bg-line" />

// Barra de título, como a do VS Code: sem a barra do sistema, é ela que guarda os botões da janela
// (os semáforos do Mac à esquerda; minimizar, maximizar e fechar do Windows à direita), arrasta a
// janela e maximiza no duplo clique. Tem fundo próprio, para o título não brigar com o canvas; os
// painéis começam abaixo dela (PANEL_TOP).
// Mostra sempre o nome do app; a conversa aberta fica só no título da janela (windowTitle).
export function TitleBar({
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
  const [coffeeOpen, setCoffeeOpen] = useState(false)
  const state = updates?.state
  const ready = state?.status === 'ready' ? state : null
  // Sutil, ao lado da versão: só enquanto procura ou baixa, para saber que a conferência rodou.
  const progress =
    state?.status === 'checking' ? 'Procurando atualização…'
    : state?.status === 'downloading' ? `Baixando ${state.version} - ${Math.round(state.progress * 100)}%`
    : null

  // Outra janela do mesmo canvas, para levar a outro monitor. No Mac o ⇧⌘N vem pelo menu Arquivo;
  // no Windows, sem menu, a tecla é tratada aqui.
  useEffect(() => {
    if (!IS_WIN) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.key.toLowerCase() !== 'n') return
      e.preventDefault()
      window.api.canvas.newWindow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = windowTitle
  }, [windowTitle])

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50).
    // O recuo acompanha o grupo da direita (café, nova janela, versão e, às vezes, atualizar) dos dois lados:
    // o título segue no centro sem encostar nele.
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`drag absolute inset-x-0 top-0 z-[35] flex items-center justify-center gap-2 border-b border-line bg-surface ${ready || progress ? 'px-[29rem]' : 'px-[19rem]'}`}
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
          {ready && (
            <button
              onClick={() => window.api.updates.install()}
              title={`Reinicia o Argus na versão ${ready.version}`}
              className="no-drag flex items-center gap-1.5 rounded-md border border-line bg-fill px-2.5 py-0.5 text-[12px] text-text hover:bg-surface-2"
            >
              <CircleArrowUp size={12} className="text-running" />
              Atualizar para {ready.version}
            </button>
          )}
          {progress && <span className="text-[12px] tabular-nums text-faint">{progress}</span>}
          <button
            onClick={() => setCoffeeOpen(true)}
            className="no-drag flex items-center gap-1.5 rounded-md border border-line bg-fill px-2.5 py-0.5 text-[12px] text-text hover:bg-surface-2"
          >
            <Coffee size={12} className="text-needs-you" />
            Me pague um café
          </button>
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
          <span className="text-[12px] tabular-nums text-faint">v{updates.version}</span>
        </div>
      )}
      {/* No body: dentro da barra (z-[35]) o modal ficaria abaixo dos painéis. */}
      {coffeeOpen && createPortal(<CoffeeDialog onClose={() => setCoffeeOpen(false)} />, document.body)}
    </div>
  )
}
