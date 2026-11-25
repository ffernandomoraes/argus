import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ActiveChat, ChatActivity } from '@argus/shared/chat';
import { tr } from '../i18n';
import { useActiveChats, useAllChats, useInterrupted, useTitles, useUnread, useWorkspaces, type RecentChat } from '../lib/data';
import { useHost, useStatus } from '../lib/host';
import { go } from '../lib/router';
import { ago, baseName, dayGroup } from '../ui/format';
import { Empty, Row, Section } from '../ui/List';
import { StatusDot } from '../ui/StatusDot';
import { SearchField } from '../ui/SearchField';
import { TabHeader } from '../ui/TabBar';
import { isTurnDone } from '../lib/background';
import { BackgroundChatRows } from './BackgroundRows';
import { ChatSearchResults } from './ChatSearch';

export function activityText(a: ChatActivity | undefined, status: string): string {
  if (status === 'needs-you') return tr('Precisa de você', 'Needs you');
  if (!a) return tr('Trabalhando…', 'Working…');
  if (a.kind === 'thinking') return tr('Pensando…', 'Thinking…');
  if (a.kind === 'writing') return tr('Escrevendo…', 'Writing…');
  const what = [a.tool, a.summary].filter(Boolean).join(' - ');
  return what || tr('Executando…', 'Running…');
}

function ActiveRow({ chat, title }: { chat: ActiveChat; title?: string }) {
  const id = chat.sessionId ?? chat.key;
  return (
    <Row
      icon={<StatusDot status={chat.status} />}
      title={title || tr('Conversa nova', 'New chat')}
      subtitle={`${baseName(chat.cwd)} - ${activityText(chat.activity, chat.status)}`}
      onClick={() => go({ name: 'chat', cwd: chat.cwd, id })}
    />
  );
}

// Quantas conversas recentes a aba mostra, agrupadas por dia.
const RECENT_COUNT = 30;

// A partir de quantas respostas não vistas aparece "Marcar todas como lidas" (igual ao Argus).
const MARK_ALL_FROM = 11;

function RecentSections({
  list,
  folderName,
  unread,
  onMarkAll,
}: {
  list: RecentChat[]
  folderName: (path: string) => string
  unread: ReadonlySet<string>
  onMarkAll: () => void
}) {
  const groups = new Map<string, RecentChat[]>();
  for (const s of list) {
    const g = dayGroup(s.repliedAt || s.updatedAt);
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  return [...groups].map(([group, chats], i) => (
    <Section
      key={group}
      title={i === 0 ? `${tr('Recentes', 'Recent')} - ${group}` : group}
      action={
        i === 0 && unread.size >= MARK_ALL_FROM ? (
          <button className="text-[13px] text-accent" onClick={onMarkAll}>
            {tr('Marcar todas como lidas', 'Mark all as read')}
          </button>
        ) : undefined
      }
    >
      {chats.map((s) => (
        <Row
          key={s.id}
          // Resposta que ninguém viu ainda: bolinha verde no lugar do balão, como no Argus.
          icon={unread.has(s.id) ? <span className="flex size-5 items-center justify-center"><StatusDot status="done" /></span> : <MessageCircle size={20} className="text-faint" />}
          title={s.title || tr('Conversa', 'Chat')}
          subtitle={folderName(s.cwd)}
          trailing={<span className="text-[12px] text-faint">{ago(s.repliedAt || s.updatedAt)}</span>}
          onClick={() => go({ name: 'chat', cwd: s.cwd, id: s.id })}
        />
      ))}
    </Section>
  ));
}

// Aba Conversas (a inicial): as que estão trabalhando ou esperando você, as interrompidas e as
// mais recentes de todas as pastas, para voltar a uma conversa sem procurar a pasta.
export function HomeScreen() {
  const { conn } = useHost();
  const status = useStatus();
  const active = useActiveChats();
  const interrupted = useInterrupted();
  const titles = useTitles([...active.map((c) => c.cwd), ...interrupted.list.map((c) => c.cwd)]);
  const { workspaces, loaded } = useWorkspaces();
  const needs = active.filter((c) => c.status === 'needs-you');
  // Já respondeu e só deixou algo em segundo plano: concluída, com o que roda embaixo dela.
  const behind = active.filter((c) => c.status !== 'needs-you' && isTurnDone(c));
  const running = active.filter((c) => c.status !== 'needs-you' && !isTurnDone(c));
  // As em andamento ou interrompidas já aparecem em cima.
  const folders = workspaces.flatMap((w) => w.groups.flatMap((g) => g.folders));
  const shown = new Set([...active.map((c) => c.sessionId), ...interrupted.list.map((c) => c.sessionId)]);
  const all = useAllChats(folders.map((f) => f.path));
  const recent = all.filter((s) => !shown.has(s.id)).slice(0, RECENT_COUNT);
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const folderName = (path: string) => folders.find((f) => f.path === path)?.name ?? baseName(path);
  const { ids: unread, markAllRead } = useUnread();
  const empty = loaded && !active.length && !interrupted.list.length && !recent.length;

  return (
    <div className="px-safe pb-tabs min-h-full">
      <TabHeader
        title={tr('Conversas', 'Chats')}
        subtitle={
          <span className="flex items-center gap-1.5">
            <span className={`inline-block size-2 shrink-0 rounded-full ${status === 'online' ? 'bg-green' : status === 'connecting' ? 'animate-pulse-dot bg-orange' : 'bg-red'}`} />
            {conn.host.hostName}
          </span>
        }
      >
        <SearchField value={query} onChange={setQuery} placeholder={tr('Buscar em todas as conversas', 'Search all chats')} />
      </TabHeader>

      {searching ? (
        <ChatSearchResults query={query} chats={all} folderName={folderName} />
      ) : (
        <>
          {active.length > 0 && (
            <Section title={tr('Em andamento', 'In progress')}>
              {[...needs, ...running].map((c) => (
                <ActiveRow key={c.key} chat={c} title={c.sessionId ? titles.get(c.sessionId) : undefined} />
              ))}
              {behind.map((c) => (
                <BackgroundChatRows
                  key={c.key}
                  chat={c}
                  title={c.sessionId ? titles.get(c.sessionId) : undefined}
                  unread={unread.has(c.sessionId ?? c.key)}
                />
              ))}
            </Section>
          )}

          {interrupted.list.length > 0 && (
            <Section title={tr('Interrompidas', 'Interrupted')} footer={tr('Pararam no meio sem você pedir. Abra para continuar.', 'They stopped midway without you asking. Open to continue.')}>
              {interrupted.list.map((c) => (
                <Row
                  key={c.sessionId}
                  icon={<StatusDot status="interrupted" />}
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

          <RecentSections list={recent} folderName={folderName} unread={unread} onMarkAll={markAllRead} />
          {empty && (
            <Section>
              <Empty>{tr('Nenhuma conversa ainda. Abra um projeto para começar.', 'No chats yet. Open a project to start.')}</Empty>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
