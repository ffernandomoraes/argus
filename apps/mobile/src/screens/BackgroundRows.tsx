import { MessageCircle } from 'lucide-react';
import type { ActiveChat, BackgroundItem } from '@argus/shared/chat';
import { tr } from '../i18n';
import { useNow } from '../lib/clock';
import { go } from '../lib/router';
import { baseName, elapsed } from '../ui/format';
import { Row } from '../ui/List';
import { StatusDot } from '../ui/StatusDot';

// Conversa que já respondeu e deixou subagente ou comando rodando (um servidor, por exemplo), como no
// Argus: ela aparece concluída (verde se ninguém viu ainda) e, embaixo, uma linha recuada para cada
// coisa que roda, com há quanto tempo. Tocar em qualquer uma abre a conversa.
export function BackgroundChatRows({ chat, title, unread }: { chat: ActiveChat; title?: string; unread: boolean }) {
  const open = () => go({ name: 'chat', cwd: chat.cwd, id: chat.sessionId ?? chat.key });
  // Argus antigo manda só a quantidade: uma linha com ela, sem nomes nem tempo.
  const items = chat.backgroundItems ?? [];
  return (
    <>
      <Row
        icon={unread ? <span className="flex size-5 items-center justify-center"><StatusDot status="done" /></span> : <MessageCircle size={20} className="text-faint" />}
        title={title || tr('Conversa nova', 'New chat')}
        subtitle={`${baseName(chat.cwd)} - ${tr('Concluída', 'Done')}`}
        onClick={open}
      />
      {items.length ? (
        items.map((item) => <ChildRow key={item.id} item={item} onClick={open} />)
      ) : (
        <ChildRow label={tr(`${chat.background} em segundo plano`, `${chat.background} in background`)} onClick={open} />
      )}
    </>
  );
}

function ChildRow({ item, label, onClick }: { item?: BackgroundItem; label?: string; onClick: () => void }) {
  const now = useNow(1000);
  const kind = item?.kind === 'agent' ? tr('Subagente', 'Subagent') : tr('Tarefa', 'Task');
  const text = item ? `${kind} - ${item.description || tr('em segundo plano', 'in background')}` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 border-b border-line py-[11px] pr-4 pl-[52px] text-left last:border-0 active:bg-card-press"
    >
      <span className="size-[7px] shrink-0 rounded-full bg-running/80" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[14px] text-muted">{text}</span>
      {item && <span className="shrink-0 text-[12px] text-faint tabular-nums">{elapsed(item.startedAt, now)}</span>}
    </button>
  );
}
