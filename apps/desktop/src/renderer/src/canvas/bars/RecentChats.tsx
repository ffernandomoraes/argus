import { memo, useRef } from 'react';
import { Clock } from 'lucide-react';
import { Presence } from '../../motion';
import { untildify } from '../../platform';
import { MenuArrow } from '../../ui/MenuArrow';
import { MENU_HOVER, MENU_PANEL, MENU_ROW } from '../../ui/menuStyles';
import { useOutsideClick } from '../../useOutsideClick';
import { useOtherBoardName } from '../allWorkspaces';
import { relativeTime } from '../relativeTime';
import { useRecentChats, type RecentChat } from '../recentChats';
import { withBoard } from '../RunningIndicator';
import { useSessions } from '../sessionsStore';
import { tr } from '../../i18n';

// Botão de histórico no canto esquerdo da barra de baixo: as últimas conversas com atividade
// (trabalharam, pediram você ou concluíram), de qualquer pasta e workspace, com o título e o
// projeto. Para achar a que foi aberta sem querer (a concluída sai do indicador ao ser vista).
// Clicar numa linha abre a conversa, como no indicador.
// `open` fica na barra, que escurece e desfoca o fundo enquanto a lista está aberta.
export const RecentChats = memo(function RecentChats({
  onOpen,
  open,
  setOpen,
}: {
  onOpen: (cwd: string, sessionId: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const recent = useRecentChats();
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const pick = (c: RecentChat) => {
    setOpen(false);
    onOpen(untildify(c.path), c.id);
  };

  return (
    <div ref={ref} className="relative flex items-center self-stretch">
      <Presence kind="menu">
        {open && (
          <div className={`absolute bottom-full left-0 mb-2.5 w-80 origin-bottom-left ${MENU_PANEL}`}>
            <MenuArrow side="bottom" align="start" at={14} />
            {recent.length ? (
              <ul className="max-h-[50vh] overflow-y-auto">
                {recent.map((c) => (
                  <RecentRow key={`${c.path}\0${c.id}`} chat={c} onOpen={() => pick(c)} />
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-1.5 text-[12px] text-muted">
                {tr('As conversas que trabalharem aparecem aqui.', 'Chats that run show up here.')}
              </p>
            )}
          </div>
        )}
      </Presence>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={tr('Conversas recentes', 'Recent chats')}
        title={tr('Conversas recentes', 'Recent chats')}
        className={`flex items-center rounded-md px-1.5 py-1 text-muted hover:bg-fill hover:text-text ${open ? 'bg-fill text-text' : ''}`}
      >
        <Clock size={14} />
      </button>
    </div>
  );
});

// Título da conversa e, ao lado, a pasta (e o workspace, se for de outro); embaixo, quando mexeu por último.
function RecentRow({ chat: c, onOpen }: { chat: RecentChat; onOpen: () => void }) {
  const found = useSessions(c.path).find((s) => s.sessionId === c.id || s.id === c.id);
  const folder = withBoard(c.path, useOtherBoardName(c.path, c.id));
  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{found?.title ?? tr('Conversa', 'Chat')}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          {found?.repliedAt && (
            <span className="truncate text-[11px] text-faint">{relativeTime(found.repliedAt)}</span>
          )}
        </span>
      </button>
    </li>
  );
}
