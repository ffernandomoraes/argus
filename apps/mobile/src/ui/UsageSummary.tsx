import { barWindow, showsUsage, usableUsage } from '@argus/shared/usage';
import { AgentIcon } from '@argus/ui/icons/AgentIcon';
import { tr } from '../i18n';
import { useUsage, type AccountUsage } from '../lib/data';
import { go } from '../lib/router';
import { Row, Section } from './List';
import { UsageBar } from './UsageBar';

// Como a barra de baixo do Argus: por conta, só a janela que vale agora (a sessão de 5 h, ou o
// semanal na conta sem sessão), com a barrinha e a porcentagem. O detalhe fica na página de uso.
function UsageSummaryRow({ row, single }: { row: AccountUsage; single: boolean }) {
  const u = row.usage ? usableUsage(row.usage, Date.now()) : null;
  const w = u ? barWindow(u) : null;
  const pct = w ? Math.max(0, Math.min(100, Math.round(w.percent))) : null;
  const dimmed = !!(u?.saved || u?.failure);
  return (
    <Row
      icon={<AgentIcon provider={row.provider} size={20} />}
      title={single ? (u?.noSession ? tr('Semana', 'Week') : tr('Sessão', 'Session')) : row.name}
      onClick={() => go({ name: 'usage' })}
      trailing={
        <span className={`flex items-center gap-2 ${dimmed ? 'opacity-50' : ''}`}>
          <UsageBar percent={pct ?? 0} className="h-1.5 w-20" />
          <span className="w-10 text-right font-mono text-[14px] tabular-nums">{pct === null ? '--' : `${pct}%`}</span>
        </span>
      }
    />
  );
}

// Só as contas com algo que valha mostrar (como no Argus): leitura parada ou antiga demais sai.
export function UsageSection() {
  const rows = useUsage().filter((r) => {
    const u = r.usage && usableUsage(r.usage, Date.now());
    return u && showsUsage(u);
  });
  if (!rows.length) return null;
  return (
    <Section title={tr('Uso', 'Usage')}>
      {rows.map((r) => (
        <UsageSummaryRow key={r.id} row={r} single={rows.length === 1} />
      ))}
    </Section>
  );
}
