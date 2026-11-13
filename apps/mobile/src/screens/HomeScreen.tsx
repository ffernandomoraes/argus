import { Folder as FolderIcon, GitBranch, Settings } from 'lucide-react';
import { barWindow, showsUsage, usableUsage } from '@argus/shared/usage';
import type { ActiveChat, ChatActivity } from '@argus/shared/chat';
import { tr } from '../i18n';
import { useActiveChats, useInterrupted, useTitles, useUsage, useWorkspaces, type AccountUsage } from '../lib/data';
import { useHost, useStatus } from '../lib/host';
import { go } from '../lib/router';
import { baseName } from '../ui/format';
import { UsageBar } from '../ui/UsageBar';
import { GroupLabel } from '../ui/GroupLabel';
import { ROUND_BUTTON } from '../ui/FloatingHeader';
import { AgentIcon } from '@argus/ui/icons/AgentIcon';
import { Empty, Row, Section } from '../ui/List';
import { StatusDot } from '../ui/StatusDot';

export function activityText(a: ChatActivity | undefined, status: string): string {
  if (status === 'needs-you') return tr('Precisa de você', 'Needs you');
  if (!a) return tr('Trabalhando…', 'Working…');
  if (a.kind === 'thinking') return tr('Pensando…', 'Thinking…');
  if (a.kind === 'writing') return tr('Escrevendo…', 'Writing…');
  const what = [a.tool, a.summary].filter(Boolean).join(' - ');
  return what || tr('Executando…', 'Running…');
}

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
          <span className="w-10 text-right font-mono text-[15px] tabular-nums">{pct === null ? '--' : `${pct}%`}</span>
        </span>
      }
    />
  );
}

function ActiveRow({ chat, title }: { chat: ActiveChat; title?: string }) {
  const id = chat.sessionId ?? chat.key;
  const waiting = !chat.turnStartedAt && chat.status === 'running' && chat.background > 0;
  return (
    <Row
      icon={<StatusDot status={chat.status} />}
      title={title || tr('Conversa nova', 'New chat')}
      subtitle={`${baseName(chat.cwd)} - ${waiting ? tr('Tarefas em segundo plano', 'Background tasks') : activityText(chat.activity, chat.status)}`}
      onClick={() => go({ name: 'chat', cwd: chat.cwd, id })}
    />
  );
}

export function HomeScreen() {
  const { conn } = useHost();
  const status = useStatus();
  const usage = useUsage();
  const active = useActiveChats();
  const interrupted = useInterrupted();
  const titles = useTitles([...active.map((c) => c.cwd), ...interrupted.list.map((c) => c.cwd)]);
  const { workspaces, loaded } = useWorkspaces();
  // Só as contas com algo que valha mostrar (como no Argus): leitura parada ou antiga demais sai.
  const usageRows = usage.filter((r) => {
    const u = r.usage && usableUsage(r.usage, Date.now());
    return u && showsUsage(u);
  });
  const needs = active.filter((c) => c.status === 'needs-you');
  const running = active.filter((c) => c.status !== 'needs-you');

  return (
    <div className="pt-safe px-safe pb-end min-h-full">
      <header className="flex items-center gap-3 px-4 pt-10 pb-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-none font-bold tracking-tight">Argus</h1>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[15px] text-muted">
            <span className={`inline-block size-2 shrink-0 rounded-full ${status === 'online' ? 'bg-green' : status === 'connecting' ? 'animate-pulse-dot bg-orange' : 'bg-red'}`} />
            {conn.host.hostName}
          </p>
        </div>
        <button type="button" onClick={() => go({ name: 'settings' })} className={ROUND_BUTTON} aria-label={tr('Ajustes', 'Settings')}>
          <Settings size={22} />
        </button>
      </header>

      {(needs.length > 0 || running.length > 0) && (
        <Section title={tr('Em andamento', 'In progress')}>
          {[...needs, ...running].map((c) => (
            <ActiveRow key={c.key} chat={c} title={c.sessionId ? titles.get(c.sessionId) : undefined} />
          ))}
        </Section>
      )}

      {interrupted.list.length > 0 && (
        <Section title={tr('Interrompidas', 'Interrupted')} footer={tr('Pararam no meio sem você pedir. Abra para continuar.', 'They stopped midway without you asking. Open to continue.')}>
          {interrupted.list.map((c) => (
            <Row
              key={c.sessionId}
              icon={<span className="inline-block size-[9px] rounded-full bg-red" />}
              title={titles.get(c.sessionId) || tr('Conversa', 'Chat')}
              subtitle={`${baseName(c.cwd)} - ${c.reason === 'memory' ? tr('faltou memória', 'out of memory') : tr('o Argus fechou', 'Argus closed')}`}
              trailing={
                <span
                  role="button"
                  className="px-1 text-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    interrupted.dismiss(c.sessionId);
                  }}
                >
                  {tr('Dispensar', 'Dismiss')}
                </span>
              }
              onClick={() => go({ name: 'chat', cwd: c.cwd, id: c.sessionId })}
            />
          ))}
        </Section>
      )}

      {usageRows.length > 0 && (
        <Section title={tr('Uso', 'Usage')}>
          {usageRows.map((r) => (
            <UsageSummaryRow key={r.id} row={r} single={usageRows.length === 1} />
          ))}
        </Section>
      )}

      {workspaces.map((w) =>
        w.groups.map((g) => (
          <Section key={`${w.id}:${g.id}`} flush title={<GroupLabel label={g.label || tr('Sem grupo', 'No group')} color={g.color} workspace={workspaces.length > 1 ? w.name : undefined} />}>
            {g.folders.map((f) => (
              <Row
                key={f.id}
                // Na cor do grupo (fora de grupo, cinza).
                icon={f.worktree ? <GitBranch size={20} style={{ color: g.color }} className="text-faint" /> : <FolderIcon size={20} style={{ color: g.color }} className="text-faint" />}
                title={f.name}
                subtitle={f.worktree ? tr('Tarefa isolada', 'Isolated task') : undefined}
                onClick={() => go({ name: 'folder', path: f.path })}
              />
            ))}
          </Section>
        )),
      )}
      {loaded && workspaces.length === 0 && (
        <Section>
          <Empty>{tr('Nenhuma pasta no canvas do Argus ainda.', 'No folders on the Argus canvas yet.')}</Empty>
        </Section>
      )}
      <p className="mt-10 text-center text-[13px] text-faint">{tr(`Versão ${__APP_VERSION__}`, `Version ${__APP_VERSION__}`)}</p>
    </div>
  );
}
