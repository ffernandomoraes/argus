import { useEffect } from 'react'
import { CircleArrowUp } from 'lucide-react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'
import { useUpdates } from '../updates/useUpdates'

// Barra de título, como a do VS Code: sem a barra do sistema (titleBarStyle: hiddenInset), é
// ela que guarda os semáforos, arrasta a janela e maximiza no duplo clique. Tem fundo próprio,
// para o título não brigar com o canvas; os painéis começam abaixo dela (PANEL_TOP).
// Mostra sempre o nome do app; a conversa aberta fica só no título da janela (windowTitle).
export function TitleBar({ windowTitle }: { windowTitle: string }) {
  const updates = useUpdates()
  const state = updates?.state
  const ready = state?.status === 'ready' ? state : null
  // Sutil, ao lado da versão: só enquanto procura ou baixa, para saber que a conferência rodou.
  const progress =
    state?.status === 'checking' ? 'Procurando atualização…'
    : state?.status === 'downloading' ? `Baixando ${state.version} - ${Math.round(state.progress * 100)}%`
    : null

  // Aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = windowTitle
  }, [windowTitle])

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50).
    // Com o botão de atualizar à direita, o recuo cresce dos dois lados: o título segue no centro.
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`drag absolute inset-x-0 top-0 z-[35] flex items-center justify-center gap-2 border-b border-line bg-surface ${ready || progress ? 'px-56' : 'px-24'}`}
    >
      <span className="text-[13px] text-muted">Argus</span>
      {/* No pnpm dev, para distinguir do app instalado aberto ao mesmo tempo. */}
      {import.meta.env.DEV && (
        <span className="rounded border border-dev/40 bg-dev/10 px-1.5 py-px text-[10px] font-medium tracking-wide text-dev uppercase">
          Desenvolvimento
        </span>
      )}
      {updates && (
        <div className="absolute inset-y-0 right-3 flex items-center gap-2.5">
          {ready && (
            <button
              onClick={() => window.api.updates.install()}
              title={`Reinicia o Argus na versão ${ready.version}`}
              className="no-drag flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-[11px] text-text hover:bg-surface-2"
            >
              <CircleArrowUp size={12} className="text-running" />
              Atualizar para {ready.version}
            </button>
          )}
          {progress && <span className="text-[11px] tabular-nums text-faint">{progress}</span>}
          <span className="text-[11px] tabular-nums text-faint">v{updates.version}</span>
        </div>
      )}
    </div>
  )
}
