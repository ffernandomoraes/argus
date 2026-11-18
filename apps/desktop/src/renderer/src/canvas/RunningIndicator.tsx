import { memo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ActiveChat, InterruptedChat } from '@argus/shared/chat';
import { Elapsed } from '../conversation/Elapsed';
import { activityLabel } from '../conversation/timeline/activityLabel';
import { Presence } from '../motion';
import { MenuArrow } from '../ui/MenuArrow';
import { MENU_HOVER, MENU_PANEL, MENU_ROW } from '../ui/menuStyles';
import { useOutsideClick } from '../useOutsideClick';
import {
  useActiveChatsEverywhere,
  useFinishedChatsEverywhere,
  useInterruptedEverywhere,
  useOtherBoardName,
  type FinishedChat,
} from './allWorkspaces';
import { displayPath } from './factory';
import { untildify } from '../platform';
import { useIsUnread, useSessions } from './sessionsStore';
import { StatusDot } from './StatusBadge';
import { tr } from '../i18n';

// No canto esquerdo da barra de baixo, enquanto alguma conversa do app (de qualquer workspace) trabalha, espera você, foi
// interrompida pelo Argus fechando (bolinha vermelha), terminou sem você ver (bolinha verde) ou já respondeu e deixou
// subagente ou comando rodando em segundo plano (conta à parte, não como trabalhando):
// quantas de cada, numa linha, e o clique abre a lista com cada uma, para cima. Clicar numa linha
// abre a conversa, trocando de workspace se ela for de outro (a concluída sai da lista ao ser vista;
// a interrompida, ao continuar).
// `open` fica na barra, que escurece e desfoca o fundo enquanto a lista está aberta.
export const RunningIndicator = memo(function RunningIndicator({
  onOpen,
  open,
  setOpen,
}: {
  onOpen: (cwd: string, sessionId: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const chats = useActiveChatsEverywhere();
  const finished = useFinishedChatsEverywhere();
  const interrupted = useInterruptedEverywhere();
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false), open);
  const empty = !chats.length && !finished.length && !interrupted.length;
  // Tudo visto: a lista fecha (e o fundo volta), e na próxima vez a pílula volta fechada.
  useEffect(() => {
    if (empty && open) setOpen(false);
  }, [empty, open, setOpen]);
  if (empty) return null;

  // Já respondeu e só deixou algo em segundo plano: concluída, com o que roda embaixo (2026-11-17).
  const busy = chats.filter((c) => !c.turnDone);
  const inBackground = chats.filter((c) => c.turnDone);
  // A concluída com algo em segundo plano tem a linha dela lá embaixo, com a bolinha verde.
  const backgroundIds = new Set(inBackground.flatMap((c) => [c.key, c.sessionId]));
  const finishedOnly = finished.filter((c) => !backgroundIds.has(c.id));
  const waiting = busy.filter((c) => c.status === 'needs-you').length;
  const working = busy.length - waiting;
  const done = finishedOnly.length;
  const stopped = interrupted.length;
  const behind = inBackground.length;
  // Cada estado com a sua bolinha, lado a lado.
  const lines = [
    { status: 'needs-you', n: waiting, text: tr(`${waiting} precisa${waiting > 1 ? 'm' : ''} de você`, `${waiting} need${waiting > 1 ? '' : 's'} you`) },
    { status: 'running', n: working, text: tr(`${working} trabalhando`, `${working} working`) },
    { status: 'interrupted', n: stopped, text: tr(`${stopped} interrompida${stopped > 1 ? 's' : ''}`, `${stopped} interrupted`) },
    { status: 'done', n: done, text: tr(`${done} concluído${done > 1 ? 's' : ''}`, `${done} done`) },
    { status: 'background', n: behind, text: tr(`${behind} em segundo plano`, `${behind} in background`) },
  ] as const;
  const pick = (cwd: string, sessionId: string) => {
    setOpen(false);
    onOpen(cwd, sessionId);
  };

  return (
    <div ref={ref} className="relative flex items-center self-stretch">
      <Presence kind="menu">
        {open && (
          <div className={`absolute bottom-full left-0 mb-2.5 w-80 origin-bottom-left ${MENU_PANEL}`}>
            <MenuArrow side="bottom" align="start" at={24} />
            <ul className="max-h-[50vh] overflow-y-auto">
              {busy.map((c) => (
                <ActiveRow key={c.key} chat={c} onOpen={() => pick(c.cwd, c.sessionId ?? c.key)} />
              ))}
              {interrupted.map((c) => (
                <InterruptedRow key={c.sessionId} chat={c} onOpen={() => pick(c.cwd, c.sessionId)} />
              ))}
              {finishedOnly.map((c) => (
                <FinishedRow key={c.id} chat={c} onOpen={() => pick(untildify(c.path), c.id)} />
              ))}
              {inBackground.map((c) => (
                <BackgroundRow key={c.key} chat={c} onOpen={() => pick(c.cwd, c.sessionId ?? c.key)} />
              ))}
            </ul>
          </div>
        )}
      </Presence>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-muted hover:bg-fill hover:text-text ${
          open ? 'bg-fill text-text' : ''
        }`}
      >
        <span className="flex items-center gap-3">
          {lines
            .filter((l) => l.n > 0)
            .map((l) => (
              <span key={l.status} className="flex items-center gap-1.5">
                {l.status === 'background' ? <BackgroundDot /> : <StatusDot status={l.status} />}
                {l.text}
              </span>
            ))}
        </span>
        {open ? <ChevronDown size={12} className="text-faint" /> : <ChevronUp size={12} className="text-faint" />}
      </button>
    </div>
  );
});

// Pasta da conversa e, se ela for de outro workspace, o nome dele.
function withBoard(path: string, board: string | null): string {
  const folder = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  return board ? `${folder} - ${board}` : folder;
}

// Uma conversa: título e pasta; embaixo, o que ela está fazendo e há quanto tempo.
function ActiveRow({ chat: c, onOpen }: { chat: ActiveChat; onOpen: () => void }) {
  const path = displayPath(c.cwd);
  const sessions = useSessions(path);
  const title = sessions.find((s) => s.id === c.sessionId)?.title ?? tr('Conversa nova', 'New chat');
  const folder = withBoard(path, useOtherBoardName(path, c.sessionId ?? c.key));
  const doing = c.status === 'needs-you' ? tr('Precisa de você', 'Needs you') : activityLabel(c.activity, c.foregroundAgents);
  const line = [doing, c.background > 0 && tr(`${c.background} em segundo plano`, `${c.background} in background`)].filter(Boolean).join(' - ');

  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">
          <StatusDot status={c.status} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">
            {line}
            {c.turnStartedAt !== undefined && (
              <>
                {' - '}
                <Elapsed since={c.turnStartedAt} />
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// O que roda em segundo plano, como a linha pendurada embaixo da conversa na caixa da pasta.
const BackgroundDot = () => <span className="size-1.5 shrink-0 rounded-full bg-running/80" aria-hidden="true" />;

// Conversa que já respondeu e deixou subagente ou comando rodando: concluída (verde se você ainda não
// viu) e, embaixo, o que roda e há quanto tempo roda o mais antigo.
function BackgroundRow({ chat: c, onOpen }: { chat: ActiveChat; onOpen: () => void }) {
  const path = displayPath(c.cwd);
  const sessions = useSessions(path);
  const id = c.sessionId ?? c.key;
  const title = sessions.find((s) => s.id === c.sessionId)?.title ?? tr('Conversa nova', 'New chat');
  const folder = withBoard(path, useOtherBoardName(path, id));
  const unread = useIsUnread(id);
  const items = c.backgroundItems ?? [];
  const names = items.map((i) => i.description || (i.kind === 'agent' ? tr('subagente', 'subagent') : tr('tarefa', 'task')));
  const since = items[0]?.startedAt;
  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">{unread ? <StatusDot status="done" /> : <BackgroundDot />}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">
            {tr('Em segundo plano', 'In background')}: {names.length ? names.join(', ') : c.background}
            {since !== undefined && (
              <>
                {' - '}
                <Elapsed since={since} />
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// Conversa que terminou sem você ver: título, pasta e "Concluído".
function FinishedRow({ chat: c, onOpen }: { chat: FinishedChat; onOpen: () => void }) {
  const folder = withBoard(c.path, useOtherBoardName(c.path, c.id));
  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">
          <StatusDot status="done" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{c.title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">{tr('Concluído', 'Done')}</span>
        </span>
      </button>
    </li>
  );
}

// Conversa que parou no meio sem você pedir: título, pasta, o motivo e o que fazer.
function InterruptedRow({ chat: c, onOpen }: { chat: InterruptedChat; onOpen: () => void }) {
  const path = displayPath(c.cwd);
  const sessions = useSessions(path);
  const title = sessions.find((s) => s.sessionId === c.sessionId)?.title ?? tr('Conversa', 'Chat');
  const folder = withBoard(path, useOtherBoardName(path, c.sessionId));
  return (
    <li>
      <button onClick={onOpen} className={`${MENU_ROW} ${MENU_HOVER} !items-start !py-1.5`}>
        <span className="mt-[5px] flex">
          <StatusDot status="interrupted" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate">{title}</span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">{folder}</span>
          </span>
          <span className="truncate text-[11px] text-faint">
            {c.reason === 'memory'
              ? tr('Parou por falta de memória - abra para continuar', 'Stopped for lack of memory - open to continue')
              : tr('Interrompida ao fechar o Argus - abra para continuar', 'Interrupted when Argus quit - open to continue')}
          </span>
        </span>
      </button>
    </li>
  );
}
