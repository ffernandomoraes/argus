import { memo, useState } from 'react'
import type { Message } from '../../types'

// Comando no terminal, como no VS Code: o comando (IN) e a saída (OUT) ficam à vista,
// resumidos em poucas linhas; um clique abre os dois inteiros. No chat reduzido (protótipo do modo
// design) fica só a linha do comando, e o clique mostra o IN/OUT.
export const BashRow = memo(function BashRow({ message, compact }: { message: Extract<Message, { role: 'tool' }>; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const command = message.detail ?? message.input
  const output = message.result.trim()
  const clamp = open ? 'max-h-60 overflow-auto' : 'line-clamp-3'
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 py-1 text-left leading-5 text-muted hover:text-text"
      >
        <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`} title={message.name}>
          {message.label}
        </span>
        <span className="truncate text-muted">{message.input}</span>
      </button>
      {/* Arrastar para copiar um trecho não conta como clique. */}
      {(!compact || open) && (
        <div
          onClick={() => !window.getSelection()?.toString() && setOpen((o) => !o)}
          className="mt-1 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-md border border-line bg-bg font-mono text-[11.5px] leading-[1.5]"
        >
          <span className="px-2 py-1.5 text-faint">IN</span>
          <div className={`whitespace-pre-wrap break-all py-1.5 pr-2 text-muted ${clamp}`}>{command}</div>
          {output && (
            <>
              <span className="border-t border-line px-2 py-1.5 text-faint">OUT</span>
              <div
                className={`whitespace-pre-wrap break-words border-t border-line py-1.5 pr-2 ${
                  message.error ? 'text-red-400' : 'text-faint'
                } ${clamp}`}
              >
                {output}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
})
