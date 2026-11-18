import type { ChatState } from '@argus/shared/chat';
import { tr } from '../i18n';
import { backgroundCount, hasBackground } from '../lib/background';
import { useNow } from '../lib/clock';
import { elapsed, formatTokens } from '../ui/format';
import { workingStatus } from './workingStatus';

// Em cima da caixa de escrever, como no Argus: o que o agente está fazendo ("Pensando…",
// "Executando comando…"), há quanto tempo e quantos tokens já gerou. Precisando de você, em vermelho.
// Com a resposta dada e algo ainda rodando em segundo plano, o que roda e há quanto tempo.
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
  // Resposta já dada, com subagente ou comando ainda rodando: "1 subagente e 1 tarefa rodando - 8m 05s".
  const agents = state.agents.filter((a) => a.background);
  const waiting = !needsYou && hasBackground(state) && (state.status === 'idle' || !state.turnStartedAt);
  // O tempo do que roda em segundo plano corre sem pedido em curso (sem o relógio da tela).
  const now = useNow(1000);
  const since = Math.min(...agents.map((a) => a.startedAt), ...Object.values(state.backgroundStarts ?? {}));
  const background = `${backgroundCount(agents.length, state.backgroundTasks)} ${tr('rodando', 'running')}`;
  const label = needsYou ? tr('Precisa de você', 'Needs you') : waiting ? background : status.label;
  const dot = needsYou ? 'bg-needs-you' : waiting ? 'bg-running/80' : 'animate-pulse-dot bg-running';
  return (
    <div className="pointer-events-auto flex min-w-0 items-center gap-2 px-2 pb-1.5 text-[12px] text-muted">
      <span className={`inline-block size-[7px] shrink-0 rounded-full ${dot}`} />
      <span className={`min-w-0 truncate ${needsYou ? 'text-needs-you' : ''}`}>{label}</span>
      {waiting && Number.isFinite(since) && <span className="shrink-0 text-faint tabular-nums">{elapsed(since, now)}</span>}
      {!waiting && status.detail && <span className="shrink-0 text-faint tabular-nums">{status.detail}</span>}
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
