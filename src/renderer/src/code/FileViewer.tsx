import { useRef } from 'react'
import type { LineRange } from '../conversation/fileLinks'
import { keys } from '../platform'
import { CloseCodeButton } from './CloseCodeButton'
import { DiffPane } from './DiffPane'
// Pergunta antes do ⌘R descartar os rascunhos (registra ao carregar, ver o arquivo).
import './draftsReloadGuard'
import { useCodeEditor } from './editor/useCodeEditor'
import { useFileRevision } from './editor/useFileRevision'
import { useFileEscape } from './fileEscape'

const VIEWS = [
  { value: true, label: 'Diff' },
  { value: false, label: 'Arquivo' }
]

// Arquivo aberto, à direita da árvore no painel de código, num editor com a coloração do VS Code
// (Dark+). ⌘S salva. O que não foi salvo fica como rascunho (drafts.ts) ao trocar de arquivo.
export function FileViewer({
  root,
  path,
  lines,
  diff,
  onDiffChange,
  onClose,
  onCloseCode
}: {
  root: string
  path: string
  // Linhas citadas num link do chat: ficam destacadas e o arquivo abre nelas.
  lines?: LineRange
  // Mostra as mudanças desde o último commit em vez do arquivo; o cabeçalho alterna.
  diff: boolean
  onDiffChange: (diff: boolean) => void
  // ESC fecha só o arquivo (volta para a árvore); o X fecha o painel de código inteiro.
  onClose: () => void
  onCloseCode: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Recarga por mudança no disco.
  const revision = useFileRevision(root, path)
  const { content, dirty, conflict, saveError, reloadFromDisk } = useCodeEditor(hostRef, { root, path, lines, revision })
  useFileEscape(onClose)

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
      <header className="flex h-12 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="min-w-0 truncate font-mono text-xs text-muted" title={path}>
          {path}
        </span>
        {dirty && (
          <span className="shrink-0 text-[12px] text-faint" title="Alterações não salvas">
            ● não salvo - {keys('⌘S')}
          </span>
        )}
        <span className="flex-1" />
        {!diff && content?.ok && content.truncated && (
          <span className="text-[12px] text-needs-you">mostrando só o primeiro 1 MB, sem edição</span>
        )}
        <div className="flex rounded-lg border border-line p-0.5 text-[12px]">
          {VIEWS.map((o) => (
            <button
              key={o.label}
              onClick={() => onDiffChange(o.value)}
              aria-pressed={diff === o.value}
              className={`rounded-md px-2 py-0.5 ${diff === o.value ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <CloseCodeButton onClick={onCloseCode} />
      </header>
      {!diff && conflict && (
        <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 text-[12px] text-needs-you">
          <span className="flex-1">O arquivo mudou no disco depois da sua edição. Salvar sobrescreve a versão do disco.</span>
          <button onClick={() => void reloadFromDisk()} className="rounded-md px-2 py-0.5 text-text hover:bg-surface-2">
            Descartar a minha e recarregar
          </button>
        </div>
      )}
      {!diff && saveError && (
        <p role="alert" className="border-b border-line bg-surface px-3 py-2 text-[12px] text-red-400">
          Não consegui salvar: {saveError}
        </p>
      )}
      {diff && <DiffPane root={root} path={path} revision={revision} />}
      {/* Fica montado no modo Diff: o editor mantém cursor, rolagem e desfazer. */}
      <div className={`min-h-0 flex-1 ${diff ? 'hidden' : 'flex flex-col'}`}>
        {!content && <p className="p-4 text-xs text-faint">Carregando…</p>}
        {content && !content.ok && <p className="p-4 text-xs text-faint">{content.error}</p>}
        <div ref={hostRef} className={`code-editor min-h-0 flex-1 select-text ${content?.ok ? '' : 'hidden'}`} />
      </div>
    </section>
  )
}
