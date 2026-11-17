import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useUncommitted } from '../canvas/sessionsStore';
import { DocumentMarkdown } from '../conversation/DocumentMarkdown';
import type { LineRange } from '../conversation/fileLinks';
import { isMod } from '../platform';
import { FileHeader, type View } from './FileHeader';
import { DiffPane } from './DiffPane';
// Pergunta antes do ⌘R descartar os rascunhos (registra ao carregar, ver o arquivo).
import './draftsReloadGuard';
import { useCodeEditor } from './editor/useCodeEditor';
import { useGitMarks } from './editor/useGitMarks';
import { useFileTools } from './fileTools/useFileTools';
import { useFileRevision } from './editor/useFileRevision';
import { useFileEscape } from './fileEscape';
import { changesInTree } from './tree/treePaths';
import { tr } from '../i18n';


const isMarkdown = (path: string) => /\.(md|markdown)$/i.test(path);

// Arquivo aberto, à direita da árvore no painel de código, num editor com a coloração do VS Code
// (Dark+). ⌘S salva. O que não foi salvo fica como rascunho (drafts.ts) ao trocar de arquivo.
// Arquivo .md tem também a prévia formatada (⌘⇧V alterna, como no VS Code), com o que está no
// editor, inclusive o não salvo.
export function FileViewer({
  root,
  path,
  lines,
  diff: wantsDiff,
  onDiffChange,
  onClose,
  onCloseCode,
  askKey,
  onDeleted,
}: {
  root: string
  path: string
  // Linhas citadas num link do chat: ficam destacadas e o arquivo abre nelas.
  lines?: LineRange
  // Mostra as mudanças desde o último commit em vez do arquivo; o cabeçalho alterna (só com mudança).
  diff: boolean
  onDiffChange: (diff: boolean) => void
  // ESC fecha só o arquivo (volta para a árvore); o X fecha o painel de código inteiro.
  onClose: () => void
  onCloseCode: () => void
  // Campo da conversa que recebe as linhas escolhidas (⌘L); nulo: nenhuma conversa desta pasta.
  askKey: string | null
  // O arquivo deixou de existir (arquivo novo desfeito).
  onDeleted: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Recarga por mudança no disco.
  const revision = useFileRevision(root, path);
  const editor = useCodeEditor(hostRef, { root, path, lines, revision });
  const { content, dirty, conflict, saveError, reloadFromDisk, docVersion, text, focus } = editor;
  useFileEscape(onClose);
  // Diff só para arquivo com mudança desde o último commit (a mesma cor da árvore); sem mudança, o
  // seletor some e o arquivo aparece mesmo que o Diff tenha sido pedido.
  const uncommitted = useUncommitted(root);
  const change = useMemo(() => changesInTree(root, uncommitted).get(path), [root, uncommitted, path]);
  const changed = !!change;
  const tools = useFileTools({ root, path, editor, change, askKey, onDeleted });
  useGitMarks(root, path, editor, `${revision}|${change ?? ''}|${dirty}`);
  const diff = wantsDiff && changed;
  const markdown = isMarkdown(path);
  const [preview, setPreview] = useState(false);
  const view: View = diff ? 'diff' : preview && markdown ? 'preview' : 'file';
  const views = useMemo(() => {
    const list: { value: View; label: string }[] = [];
    if (changed) list.push({ value: 'diff', label: 'Diff' });
    list.push({ value: 'file', label: tr('Arquivo', 'File') });
    if (markdown) list.push({ value: 'preview', label: tr('Prévia', 'Preview') });
    return list;
  }, [changed, markdown]);
  const choose = (next: View) => {
    onDiffChange(next === 'diff');
    setPreview(next === 'preview');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- docVersion: o texto do editor mudou
  const previewText = useMemo(() => (view === 'preview' ? text() : ''), [view, docVersion, content]);
  // O foco vai junto da troca: sem isso, ficava no editor escondido e o ⌘⇧V seguinte não chegava.
  const previewRef = useRef<HTMLDivElement>(null);
  const switched = useRef(false);
  useEffect(() => {
    if (!switched.current) return;
    switched.current = false;
    if (view === 'preview') previewRef.current?.focus();
    else if (view === 'file') focus();
  }, [view, focus]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (view === 'file' && tools.onKeyDown(e)) return;
    if (!markdown || !isMod(e) || !e.shiftKey || e.altKey || e.key.toLowerCase() !== 'v') return;
    e.preventDefault();
    switched.current = true;
    choose(view === 'preview' ? 'file' : 'preview');
  };

  // O editor à vista e carregado: as ferramentas dele aparecem no cabeçalho.
  const ready = view === 'file' && content?.ok === true;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1e1e1e]" onKeyDownCapture={onKeyDown}>
      <FileHeader
        path={path}
        dirty={dirty}
        truncated={ready && content.truncated}
        view={view}
        views={views}
        markdown={markdown}
        onChoose={choose}
        tools={ready ? tools : null}
        onCloseCode={onCloseCode}
      />
      {view === 'file' && conflict && (
        <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 text-[12px] text-needs-you">
          <span className="flex-1">
            {tr(
              'O arquivo mudou no disco depois da sua edição. Salvar sobrescreve a versão do disco.',
              'The file changed on disk after your edit. Saving overwrites the version on disk.',
            )}
          </span>
          <button onClick={() => void reloadFromDisk()} className="rounded-md px-2 py-0.5 text-text hover:bg-surface-2">
            {tr('Descartar a minha e recarregar', 'Discard mine and reload')}
          </button>
        </div>
      )}
      {view === 'file' && saveError && (
        <p role="alert" className="border-b border-line bg-surface px-3 py-2 text-[12px] text-red-400">
          {tr('Não consegui salvar:', 'Could not save:')} {saveError}
        </p>
      )}
      {diff && <DiffPane root={root} path={path} revision={revision} />}
      {view === 'preview' && (
        <div ref={previewRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-bg outline-none select-text">
          <div className="mx-auto max-w-[820px] px-8 py-6">
            <DocumentMarkdown text={previewText} />
          </div>
        </div>
      )}
      {/* Fica montado no Diff e na prévia: o editor mantém cursor, rolagem e desfazer. */}
      <div className={`min-h-0 flex-1 ${view === 'file' ? 'flex flex-col' : 'hidden'}`}>
        {!content && <p className="p-4 text-xs text-faint">{tr('Carregando…', 'Loading…')}</p>}
        {content && !content.ok && <p className="p-4 text-xs text-faint">{content.error}</p>}
        <div ref={hostRef} className={`code-editor min-h-0 flex-1 select-text ${content?.ok ? '' : 'hidden'}`} />
      </div>
    </section>
  );
}
