import { memo } from 'react'
import type { Message } from '../../types'
import { DiffView } from '../../DiffView'
import { diffStats } from '../../diffLines'
import type { ImageView } from '../imageViews'
import { LazyDetails } from './LazyDetails'

// Ferramentas cujo detalhe é o caminho de um arquivo ou pasta (ver toolLabels no main).
const PATH_TOOLS = new Set(['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Grep', 'Glob'])

// Caminho em uma linha, cortado no começo: o "…" fica na frente e o fim (pasta e arquivo) sempre à
// vista. A direção da direita para a esquerda é o que põe o corte no começo; as marcas invisíveis
// (\u200E) mantêm a barra inicial no lugar. Inteiro na dica.
function PathLine({ path }: { path: string }) {
  return (
    <div title={path} className="mt-1 truncate rounded-md bg-bg px-2 py-1 text-left font-mono text-xs text-muted [direction:rtl]">
      {`\u200E${path}\u200E`}
    </div>
  )
}

export const ToolRow = memo(function ToolRow({
  message,
  compact,
  image
}: {
  message: Extract<Message, { role: 'tool' }>
  compact?: boolean
  image?: ImageView
}) {
  const stats = message.diff && diffStats(message.diff)
  const detail = message.detail && message.detail !== message.input ? message.detail : undefined
  const pathDetail = !!detail && PATH_TOOLS.has(message.name) && !detail.includes('\n')
  // Sem caixa, como a resposta: a ação não chama mais atenção que o texto. Passar o mouse só clareia a linha.
  return (
    <LazyDetails
      className="group text-[13px]"
      open={!compact && !!message.diff}
      summary={
        <summary
          className="flex cursor-pointer list-none items-center gap-2 py-1 leading-5 text-muted hover:text-text"
          title={image ? message.detail : undefined}
          onClick={
            image &&
            ((e) => {
              e.preventDefault()
              image.open(0)
            })
          }
        >
          <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`} title={message.name}>
            {message.label}
          </span>
          <span className={`truncate ${image ? 'underline decoration-line-strong underline-offset-2' : 'text-muted'}`}>
            {message.input}
          </span>
          {stats && (
            <span className="ml-auto shrink-0 font-mono">
              <span className="text-emerald-400">+{stats.added}</span>{' '}
              <span className="text-red-400">−{stats.removed}</span>
            </span>
          )}
        </summary>
      }
    >
      {pathDetail && <PathLine path={detail} />}
      {detail && !pathDetail && (
        <div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-muted">
          {detail}
        </div>
      )}
      {message.diff ? (
        <div className="mt-1">
          <DiffView hunks={message.diff} />
        </div>
      ) : (
        message.result && (
          <div className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-faint">
            {message.result}
          </div>
        )
      )}
    </LazyDetails>
  )
})
