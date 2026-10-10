import { memo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Message } from '../../types'

// Comando no terminal: fica só a linha do comando, com a seta no fim; o clique abre o comando
// inteiro (IN) e a saída (OUT).
export const BashRow = memo(function BashRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const [open, setOpen] = useState(false)
  const command = message.detail ?? message.input
  const output = message.result.trim()
  const box = 'max-h-60 overflow-auto'
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
        <ChevronRight size={13} className={`ml-auto shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>
      {/* Arrastar para copiar um trecho não conta como clique. */}
      {open && (
        <div
          onClick={() => !window.getSelection()?.toString() && setOpen(false)}
          className="mt-1 grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 rounded-md border border-line bg-bg font-mono text-[11.5px] leading-[1.5]"
        >
          <span className="px-2 py-1.5 text-faint">IN</span>
          <div className={`whitespace-pre-wrap break-all py-1.5 pr-2 text-muted ${box}`}>{command}</div>
          {output && (
            <>
              <span className="border-t border-line px-2 py-1.5 text-faint">OUT</span>
              <div
                className={`whitespace-pre-wrap break-words border-t border-line py-1.5 pr-2 ${
                  message.error ? 'text-red-400' : 'text-faint'
                } ${box}`}
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
