import { useEffect } from 'react'
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel'

// Barra de título, como a do VS Code: sem a barra do sistema (titleBarStyle: hiddenInset), é
// ela que guarda os semáforos, arrasta a janela e maximiza no duplo clique. Tem fundo próprio,
// para o título não brigar com o canvas; os painéis começam abaixo dela (PANEL_TOP).
export function TitleBar({ title }: { title: string }) {
  // O mesmo título vai para a janela: aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = title
  }, [title])

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50).
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className="drag absolute inset-x-0 top-0 z-[35] flex items-center justify-center border-b border-line bg-surface px-24"
    >
      <span className="truncate text-[13px] text-muted">{title}</span>
    </div>
  )
}
