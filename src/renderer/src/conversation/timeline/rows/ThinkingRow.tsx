import { memo } from 'react'
import { Brain } from 'lucide-react'
import type { Message } from '../../types'
import { LazyDetails } from './LazyDetails'

// Raciocínio do Claude: uma linha recolhida ("Pensou por 4s"), aberta com um clique.
export const ThinkingRow = memo(function ThinkingRow({ message }: { message: Extract<Message, { role: 'thinking' }> }) {
  return (
    <LazyDetails
      className="group text-[13px]"
      summary={
        <summary className="-ml-1 flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 leading-5 text-faint hover:bg-surface-2 hover:text-muted">
          <Brain size={12} className="shrink-0" />
          <span className="italic">
            {message.seconds && message.seconds > 0 ? `Pensou por ${message.seconds}s` : 'Pensou um pouco'}
          </span>
        </summary>
      }
    >
      <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words border-l border-line pl-3 text-[13px] italic leading-relaxed text-muted">
        {message.text}
      </div>
    </LazyDetails>
  )
})
