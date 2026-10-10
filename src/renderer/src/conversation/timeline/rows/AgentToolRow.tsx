import { memo } from 'react'
import { Bot } from 'lucide-react'
import type { RunningAgent } from '../../../../../shared/agents'
import { agentActivity, useRunningAgent } from '../../../canvas/runningAgents'
import { Elapsed } from '../../Elapsed'
import { Markdown } from '../../Markdown'
import type { Message } from '../../types'
import { LazyDetails } from './LazyDetails'

const SECTION_TITLE = 'mb-1 px-1 text-[13px] uppercase tracking-wide text-faint'

// Subagente chamado pela conversa: qual agente, o pedido que recebeu, o que está fazendo
// (enquanto roda) e o que entregou. O relatório só é formatado ao abrir a linha.
export const AgentToolRow = memo(function AgentToolRow({ message }: { message: Extract<Message, { role: 'tool' }> }) {
  const running = useRunningAgent(message.toolUseId)
  return (
    <LazyDetails
      className="group rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[13px]"
      summary={
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 leading-5 text-muted hover:bg-line/50">
          <Bot size={13} className={`shrink-0 ${running ? 'text-running' : message.error ? 'text-red-400' : 'text-text'}`} />
          <span className={`shrink-0 font-medium ${message.error ? 'text-red-400' : 'text-text'}`}>{message.agent}</span>
          <span className="truncate text-muted">{running ? agentActivity(running) : message.input}</span>
          {running && (
            <span className="ml-auto shrink-0 pl-1 tabular-nums text-faint">
              <Elapsed since={running.startedAt} />
            </span>
          )}
        </summary>
      }
    >
      <AgentReport message={message} running={running} />
    </LazyDetails>
  )
})

// O corpo da linha aberta: pedido, atividade (enquanto roda) e o que entregou.
function AgentReport({ message, running }: { message: Extract<Message, { role: 'tool' }>; running?: RunningAgent }) {
  const steps = running?.steps ?? []
  return (
    <>
      {message.detail && (
        <div className="mt-1.5">
          <div className={SECTION_TITLE}>Pedido</div>
          <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg px-2 py-1.5 text-[13px] text-muted">
            {message.detail}
          </div>
        </div>
      )}
      {steps.length > 0 && (
        <div className="mt-1.5">
          <div className={SECTION_TITLE}>Atividade - {running?.toolUses || steps.length} ferramentas</div>
          <ul className="max-h-48 overflow-auto rounded-md bg-bg px-2 py-1.5 text-[13px]">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-text">{s.label}</span>
                <span className="truncate text-faint">{s.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {message.result && (
        <div className="mt-1.5">
          <div className={SECTION_TITLE}>Entregou</div>
          <div className="max-h-96 overflow-auto rounded-md bg-bg px-3 py-2 text-[13px] leading-relaxed text-text">
            <Markdown text={message.result} />
          </div>
        </div>
      )}
    </>
  )
}
