import { keys } from '../platform';
import { tr } from '../i18n';
import { CloseCodeButton } from './CloseCodeButton';
import { FileToolbar } from './fileTools/FileToolbar';
import type { FileTools } from './fileTools/useFileTools';

export type View = 'diff' | 'file' | 'preview';

type Props = {
  path: string
  dirty: boolean
  // Arquivo maior que 1 MB: aparece cortado e só para leitura.
  truncated: boolean
  view: View
  views: { value: View; label: string }[]
  markdown: boolean
  onChoose: (view: View) => void
  // Ferramentas do editor (só com o arquivo à vista, já carregado).
  tools: FileTools | null
  onCloseCode: () => void
};

// Cabeçalho do arquivo aberto: o caminho, o aviso de não salvo, o seletor Diff/Arquivo/Prévia, as
// ferramentas do editor e o X do painel. Embaixo, o aviso de uma ferramenta (por uns segundos).
export function FileHeader({ path, dirty, truncated, view, views, markdown, onChoose, tools, onCloseCode }: Props) {
  return (
    <>
      <header className="flex h-12 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="min-w-0 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </span>
        {dirty && (
          <span className="shrink-0 text-[12px] text-faint" title={tr('Alterações não salvas', 'Unsaved changes')}>
            {tr(`● não salvo - ${keys('⌘S')}`, `● unsaved - ${keys('⌘S')}`)}
          </span>
        )}
        <span className="flex-1" />
        {truncated && <span className="text-[12px] text-needs-you">{tr('mostrando só o primeiro 1 MB, sem edição', 'showing only the first 1 MB, read-only')}</span>}
        {views.length > 1 && (
          <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
            {views.map((o) => (
              <button
                key={o.value}
                onClick={() => onChoose(o.value)}
                aria-pressed={view === o.value}
                title={o.value === 'preview' || (markdown && o.value === 'file') ? keys('⇧⌘V') : undefined}
                className={`rounded-md px-2 py-0.5 ${view === o.value ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {tools && <FileToolbar tools={tools} />}
        <CloseCodeButton onClick={onCloseCode} />
      </header>
      {tools?.notice && <p className="border-b border-line bg-surface px-3 py-2 text-[12px] text-needs-you">{tools.notice}</p>}
    </>
  );
}
