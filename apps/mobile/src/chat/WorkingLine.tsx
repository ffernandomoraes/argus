import type { ChatState } from '@argus/shared/chat';
import { tr } from '../i18n';
import { elapsed, formatTokens } from '../ui/format';
import { workingStatus } from './workingStatus';

// Em cima da caixa de escrever, como no Argus: o que o agente está fazendo ("Pensando…",
// "Executando comando…"), há quanto tempo e quantos tokens já gerou. Precisando de você, em vermelho.
export function WorkingLine({ state }: { state: ChatState }) {
  const needsYou = state.status === 'needs-you';
  const status = workingStatus({
    activity: state.activity,
    foreground: state.agents.filter((a) => !a.background).length,
    retry: state.retry,
    compactingSince: state.compactingSince,
    turnStartedAt: state.turnStartedAt,
    now: Date.now(),
  });
  const waiting = !state.turnStartedAt && state.status === 'running' && state.backgroundTasks + state.agents.filter((a) => a.background).length > 0;
  const label = needsYou ? tr('Precisa de você', 'Needs you') : waiting ? tr('Tarefas em segundo plano…', 'Background tasks…') : status.label;
  return (
    <div className="pointer-events-auto flex min-w-0 items-center gap-2 px-2 pb-1.5 text-[12px] text-muted">
      <span className={`inline-block size-[7px] shrink-0 rounded-full ${needsYou ? 'bg-needs-you' : 'animate-pulse-dot bg-running'}`} />
      <span className={`min-w-0 truncate ${needsYou ? 'text-needs-you' : ''}`}>{label}</span>
      {status.detail && <span className="shrink-0 text-faint tabular-nums">{status.detail}</span>}
      {status.progress !== undefined && (
        <span className="h-[3px] w-12 shrink-0 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-running" style={{ width: `${status.progress}%` }} />
        </span>
      )}
      {state.turnStartedAt ? (
        <span className="ml-auto shrink-0 text-faint tabular-nums">
          {elapsed(state.turnStartedAt)}
          {state.turnTokens > 0 && ` - ${formatTokens(state.turnTokens)}`}
        </span>
      ) : null}
    </div>
  );
}
