import { memo } from 'react'
import type { Message } from '../../types'
import { DiffView } from '../../DiffView'
import { diffStats } from '../../diffLines'
import { LazyDetails } from './LazyDetails'

// Ação do Claude (ler, editar, buscar...): o nome e para que serve numa linha; o clique mostra o
// detalhe, a edição ou o resultado. Edição já vem aberta. No chat reduzido (protótipo do modo
// design), a edição fica só na linha, com o +/-: o clique abre o detalhe.
export const ToolRow = memo(function ToolRow({ message, compact }: { message: Extract<Message, { role: 'tool' }>; compact?: boolean }) {
  const stats = message.diff && diffStats(message.diff)
  // Sem caixa, como a resposta: a ação não chama mais atenção que o texto. Passar o mouse só clareia a linha.
  return (
    <LazyDetails
      className="group text-[13px]"
      open={!compact && !!message.diff}
      summary={
        <summary className="flex cursor-pointer list-none items-center gap-2 py-1 leading-5 text-muted hover:text-text">
          <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`} title={message.name}>
            {message.label}
          </span>
          <span className="truncate text-muted">{message.input}</span>
          {stats && (
            <span className="ml-auto shrink-0 font-mono">
              <span className="text-emerald-400">+{stats.added}</span>{' '}
              <span className="text-red-400">−{stats.removed}</span>
            </span>
          )}
        </summary>
      }
    >
      {message.detail && message.detail !== message.input && (
        <div className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-muted">
          {message.detail}
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
