import { ClipboardList, FileText, X } from 'lucide-react'
import { CopyButton } from '../../conversation/CopyButton'
import { DocumentMarkdown } from '../../conversation/DocumentMarkdown'
import { PathLine } from '../../conversation/PlanCard'
import { baseName } from '../../platform'
import { PANEL_BOTTOM, PANEL_MARGIN, PANEL_TOP } from '../../conversation/FloatingPanel'
import { usePreference } from '../../settings/preferences'
import { IconButton } from '../../ui/IconButton'
import { useEscape } from '../../useEscape'
import { tr } from '../../i18n'

// Mais estreito que isso, o plano fica por baixo do drawer (que anda por cima) em vez de sumir.
const MIN_WIDTH = 280

// Plano inteiro (ou o .md criado, com `path`), formatado como documento, à esquerda do drawer da
// conversa que o abriu: vai da borda da janela até a borda do drawer (`drawerX`), na altura toda.
// ESC fecha. Segue o zoom do drawer (⌘+ / ⌘-).
export function PlanPanel({ text, path, drawerX, onClose }: { text: string; path?: string; drawerX: number; onClose: () => void }) {
  const zoom = usePreference('drawerZoom')
  useEscape(onClose)
  return (
    <aside
      style={{ top: PANEL_TOP, bottom: PANEL_BOTTOM, left: PANEL_MARGIN, width: Math.max(MIN_WIDTH, drawerX - PANEL_MARGIN * 2) }}
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        {path ? <FileText size={14} className="shrink-0 text-muted" /> : <ClipboardList size={14} className="shrink-0 text-muted" />}
        {/* O título do plano já abre o documento: aqui, só o que é. Do .md, o nome e o caminho. */}
        {path ? (
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-sm font-medium">{baseName(path)}</span>
            <PathLine path={path} className="min-w-0 flex-1" />
          </div>
        ) : (
          <span className="flex-1 text-sm font-medium">{tr('Plano', 'Plan')}</span>
        )}
        <CopyButton text={text} label={path ? tr('Copiar texto', 'Copy text') : tr('Copiar plano', 'Copy plan')} />
        <IconButton label={path ? tr('Fechar', 'Close') : tr('Fechar plano', 'Close plan')} onClick={onClose}>
          <X size={15} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto select-text">
        <div className="mx-auto max-w-[820px] px-8 py-6" style={zoom === 1 ? undefined : { zoom }}>
          <DocumentMarkdown text={text} />
        </div>
      </div>
    </aside>
  )
}
