import { expiredUsage, showsUsage, usableUsage, type Usage, type UsageWindow } from '@argus/shared/usage';
import { tr } from '../i18n';
import { useUsage, type AccountUsage } from '../lib/data';
import { back } from '../lib/router';
import { Empty, Section } from '../ui/List';
import { FLOATING_HEADER_SPACE, FloatingHeader } from '../ui/FloatingHeader';
import { UsageBar } from '../ui/UsageBar';
import { AgentIcon } from '@argus/ui/icons/AgentIcon';
import { resetLabel, staleText, timeLeft, windowTitle } from '../ui/usageFormat';

// Os limites de cada conta em detalhe, como o painel que abre na barra de baixo do Argus: cada
// janela com a porcentagem, quanto falta e quando recomeça.

type WindowLine = { title: string; window: UsageWindow | null; note?: string };

// As mesmas linhas do painel do Argus (UsagePanel.tsx rowsOf): no Claude, sessão de 5 horas e
// semanal sempre (com aviso quando não há número); nos outros agentes, as janelas que existem.
function linesOf(row: AccountUsage, usage: Usage): WindowLine[] {
  const restarted = tr('Recomeçou, aguardando a próxima leitura', 'Restarted, waiting for the next reading');
  if (!row.provider) {
    return [
      {
        title: tr('Sessão (5 horas)', 'Session (5 hours)'),
        window: usage.session,
        note: usage.noSession ? tr('Sem limite neste plano', 'No limit on this plan') : usage.restarted?.session ? restarted : undefined,
      },
      { title: tr('Semanal', 'Weekly'), window: usage.weekly, note: usage.restarted?.weekly ? restarted : undefined },
      ...usage.models.map((m) => ({ title: tr(`Semanal ${m.name}`, `Weekly ${m.name}`), window: m.window })),
    ];
  }
  const windows = [usage.session, usage.weekly].filter((w): w is UsageWindow => !!w);
  const lines: WindowLine[] = [
    ...windows.map((w) => ({ title: windowTitle(w.minutes), window: w })),
    ...usage.models.map((m) => ({ title: `${m.name} - ${windowTitle(m.window.minutes)}`, window: m.window })),
  ];
  if (!lines.length && usage.restarted) return [{ title: windowTitle(), window: null, note: restarted }];
  return lines;
}

function WindowDetail({ title, window, note, now }: WindowLine & { now: number }) {
  if (!window)
    return (
      <div className="py-2.5">
        <div className="text-[15px]">{title}</div>
        <div className="mt-0.5 text-[14px] text-muted">{note ?? tr('Sem dados', 'No data')}</div>
      </div>
    );
  const pct = Math.round(window.percent);
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px]">{title}</span>
        <span className="font-mono text-[14px] tabular-nums">{pct}%</span>
      </div>
      <UsageBar percent={pct} className="mt-1.5 h-1.5" />
      <p className="mt-1 text-[14px] text-muted">
        {window.resetsAt
          ? tr(`Reseta em ${timeLeft(window.resetsAt, now)} - ${resetLabel(window.resetsAt, now)}`, `Resets in ${timeLeft(window.resetsAt, now)} - ${resetLabel(window.resetsAt, now)}`)
          : tr('Começa a contar na próxima mensagem', 'Starts counting on the next message')}
      </p>
    </div>
  );
}

function AccountCard({ row, usage, now }: { row: AccountUsage; usage: Usage; now: number }) {
  const stale = staleText(usage, expiredUsage(usage, now));
  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          <AgentIcon provider={row.provider} size={15} />
          {row.name}
          {usage.saved ? tr(' - guardado', ' - saved') : ''}
        </span>
      }
      footer={stale ?? undefined}
    >
      <div className={`px-4 ${usage.saved || usage.failure ? 'opacity-60' : ''}`}>
        {linesOf(row, usage).map((l) => (
          <WindowDetail key={l.title} {...l} now={now} />
        ))}
      </div>
    </Section>
  );
}

export function UsageScreen() {
  const rows = useUsage();
  const now = Date.now();
  // Como no Argus: só o que ainda vale (janela recomeçada fica sem número, com o aviso).
  const shown = rows.flatMap((row) => {
    const usage = row.usage && usableUsage(row.usage, now);
    return usage && showsUsage(usage) ? [{ row, usage }] : [];
  });
  return (
    <div className="min-h-full">
      <FloatingHeader title={tr('Uso', 'Usage')} onBack={() => back({ name: 'settings' })} backLabel={tr('Conta', 'Account')} />
      <div className={`px-safe pb-end ${FLOATING_HEADER_SPACE}`}>
        {shown.map(({ row, usage }) => (
          <AccountCard key={row.id} row={row} usage={usage} now={now} />
        ))}
        {!shown.length && (
          <Section>
            <Empty>{tr('Nenhuma conta com uso para mostrar.', 'No account usage to show.')}</Empty>
          </Section>
        )}
      </div>
    </div>
  );
}
