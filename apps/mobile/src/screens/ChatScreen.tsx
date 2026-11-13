import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { FLOATING_HEADER_SPACE, FloatingHeader } from '../ui/FloatingHeader';
import type { ChatSettings, PermissionAnswer } from '@argus/shared/chat';
import type { AttachedFile } from '@argus/shared/attachedFiles';
import type { Message } from '@argus/shared/history';
import { Composer, type Draft } from '../chat/Composer';
import { MarkdownText, MessageView, UserBubble } from '../chat/MessageView';
import { PermissionCard } from '../chat/PermissionCard';
import { turnFooters } from '../chat/turnFooters';
import { tr } from '../i18n';
import { useAgentInfo, useAuthState, useChatDetails, useChatState, useProvidersState, useSessions, useWorkspaces } from '../lib/data';
import { parseAgentRef } from '@argus/shared/providers';
import { AccountPicker, resolveAccount } from '../chat/AccountPicker';
import { DEFAULT_SETTINGS, loadPrefs, movePrefs, savePrefs } from '../chat/options';
import { newChatId } from './FolderScreen';
import { useHost, useStatus } from '../lib/host';
import { imageForSend, isImage } from '../lib/images';
import { cacheGet, cacheSet } from '../lib/cache';
import { back, go, replace } from '../lib/router';
import { baseName, elapsed } from '../ui/format';
import { activityText } from './HomeScreen';

// Uma conversa: o histórico, o que o agente está fazendo agora, os pedidos de permissão e a caixa de
// escrever, com a conta na barra do topo e modelo/esforço/modo/contexto/comandos em cima da caixa.
// Conversa nova ("new-...") vira a da sessão assim que o agente a grava.

const PAGE = 40;

// Último histórico lido de cada conversa (na memória e no aparelho, ver lib/cache.ts): reabrir
// mostra na hora e atualiza por baixo.
type SavedHistory = { messages: Message[]; more: boolean };
const savedHistory = (sessionId: string) => cacheGet<SavedHistory>(`history:${sessionId}`);

type Pending = { id: number; text: string; images: number; files: string[]; at: number };

const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;

function useTicker(on: boolean): void {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const timer = setInterval(() => setT((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [on]);
}

export function ChatScreen({ cwd, id }: { cwd: string; id: string }) {
  const { conn, epoch } = useHost();
  const status = useStatus();
  // A chave da conversa fica a mesma enquanto a tela está aberta, mesmo quando a nova ganha a sessão.
  const [chatKey, setChatKey] = useState(id);
  const state = useChatState(chatKey);
  const sessionId = state?.sessionId ?? (chatKey.startsWith('new-') ? undefined : chatKey);
  const { list } = useSessions(cwd);
  // A conta do grupo e as pastas do workspace vão em cada envio: sem elas, uma conversa aberta numa
  // conta que não é a padrão reabriria na padrão. O envio espera a lista chegar.
  const { workspaces, loaded: foldersLoaded } = useWorkspaces();
  const folder = workspaces.flatMap((w) => w.groups.flatMap((g) => g.folders)).find((f) => f.path === cwd);
  const title = (sessionId && list?.find((s) => s.id === sessionId)?.title) || (sessionId ? '' : tr('Conversa nova', 'New chat'));

  // --- Conta e modelo/esforço/modo ---
  // Guardados por conversa neste aparelho (como a janela do Argus faz). Conversa aberta no Argus vale
  // o que ela usa de verdade (chat:details); conversa de outro agente, o agente dela; senão, a conta
  // do grupo da pasta.
  const prefsId = sessionId ?? chatKey;
  const [chosenAccount, setChosenAccount] = useState<string | undefined>(() => loadPrefs(prefsId).account);
  const [settings, setSettings] = useState<ChatSettings>(() => loadPrefs(prefsId).settings ?? DEFAULT_SETTINGS);
  const details = useChatDetails(chatKey, state?.status);
  const summary = sessionId ? list?.find((s) => s.id === sessionId) : undefined;
  const account = details?.account ?? chosenAccount ?? summary?.agent ?? folder?.account;
  const auth = useAuthState();
  const providers = useProvidersState();
  const resolved = resolveAccount(account, auth, providers);
  const info = useAgentInfo(resolved?.id);
  const agentChat = !!parseAgentRef(resolved?.id);
  const contextPercent = summary?.contextPercent ?? 0;
  useEffect(() => {
    if (details?.settings) setSettings(details.settings);
  }, [details]);
  // Conversa nova gravada: o que foi escolhido nela vai para o id da sessão.
  useEffect(() => {
    if (sessionId && chatKey !== sessionId) movePrefs(chatKey, sessionId);
  }, [sessionId, chatKey]);

  const changeSettings = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrefs(prefsId, { settings: next });
    // Aberta no Argus: a troca vale já (como nos seletores de lá).
    if (state) void conn.call('chat:configure', chatKey, patch).catch(() => {});
  };
  const changeAccount = (a: string) => {
    setChosenAccount(a);
    savePrefs(prefsId, { account: a });
  };

  // Notificação de outra conversa com esta tela aberta: troca de conversa.
  useEffect(() => {
    if (id !== chatKey && id !== sessionId) setChatKey(id);
  }, [id]);

  // Conversa nova gravada: o endereço passa a ser o da sessão (voltar e notificações acham ela).
  useEffect(() => {
    if (sessionId && id !== sessionId) replace({ name: 'chat', cwd, id: sessionId });
  }, [sessionId, id, cwd]);

  // --- Histórico ---
  const cached = sessionId ? savedHistory(sessionId) : undefined;
  const [messages, setMessages] = useState<Message[]>(cached?.messages ?? []);
  const [more, setMore] = useState(cached?.more ?? false);
  const [loaded, setLoaded] = useState(!!cached);
  const count = useRef(PAGE);
  const first = useRef<string | undefined>(undefined);
  const stick = useRef(true);

  const load = useCallback(
    async (older = false) => {
      if (!sessionId) return;
      if (older) count.current += PAGE;
      const page = await conn.call('sessions:historyPage', cwd, sessionId, { since: older ? undefined : first.current, count: count.current });
      first.current = page.messages[0]?.id;
      count.current = Math.max(count.current, page.messages.length);
      stick.current = !older && nearBottom();
      cacheSet(`history:${sessionId}`, page);
      setMessages(page.messages);
      setMore(page.more);
      setLoaded(true);
    },
    [conn, cwd, sessionId],
  );

  useEffect(() => {
    first.current = undefined;
    count.current = PAGE;
    const saved = sessionId ? savedHistory(sessionId) : undefined;
    setMessages(saved?.messages ?? []);
    setMore(saved?.more ?? false);
    setLoaded(!sessionId || !!saved);
    stick.current = true;
  }, [sessionId]);

  const revision = state?.revision ?? 0;
  useEffect(() => {
    if (status === 'online') void load().catch(() => {});
  }, [load, revision, epoch, status]);
  // Sem sessão aberta aqui (a conversa roda num terminal, por exemplo), o arquivo avisa.
  useEffect(() => conn.on('sessions:changed', (p) => p === cwd && void load().catch(() => {})), [conn, cwd, load]);

  // --- Mensagens enviadas que ainda não estão no histórico ---
  const [pending, setPending] = useState<Pending[]>([]);
  useEffect(() => {
    if (!pending.length) return;
    const users = messages.filter((m) => m.role === 'user').slice(-10);
    const queued = state?.queued ?? [];
    setPending((prev) =>
      prev.filter((p) => Date.now() - p.at < 60_000 && !users.some((u) => u.role === 'user' && u.text.trim().startsWith(p.text.slice(0, 40))) && !queued.some((q) => q.text.startsWith(p.text.slice(0, 40)))),
    );
  }, [messages, state?.queued]);

  // Rola até o fim ao abrir e quando chega coisa nova com você já embaixo.
  useLayoutEffect(() => {
    if (stick.current) window.scrollTo(0, document.documentElement.scrollHeight);
  }, [messages, pending, state?.partial, state?.permissions.length]);

  const running = state?.status === 'running' || state?.status === 'needs-you';
  // Rodapé de cada pedido (hora, quanto levou, tokens) na última resposta dele, como no Argus.
  const footers = turnFooters(messages, running);
  useTicker(!!state?.turnStartedAt && running);

  const send = async ({ text, files }: Draft) => {
    const images = await Promise.all(files.filter(isImage).map(imageForSend));
    const attached: AttachedFile[] = [];
    for (const f of files.filter((f) => !isImage(f))) {
      const res = await conn.call('files:upload', f.name, new Uint8Array(await f.arrayBuffer()));
      if (!res.ok) throw new Error(res.error);
      attached.push({ path: res.path, size: f.size });
    }
    await conn.call('chat:send', {
      key: chatKey,
      cwd,
      folders: folder?.folders,
      account,
      sessionId,
      settings,
      text,
      images,
      files: attached,
    });
    stick.current = true;
    setPending((p) => [...p, { id: Date.now(), text, images: images.length, files: attached.map((a) => a.path), at: Date.now() }]);
  };

  const command = (name: 'compact' | 'clear' | 'rename') => {
    if (name === 'clear') return go({ name: 'chat', cwd, id: newChatId() });
    if (name === 'compact') return void send({ text: '/compact', files: [] }).catch(() => {});
    if (!sessionId) return;
    const current = list?.find((s) => s.id === sessionId)?.title ?? '';
    const next = prompt(tr('Novo nome da conversa', 'New chat name'), current)?.trim();
    if (next) void conn.call('chat:rename', { key: chatKey, cwd, sessionId, title: next }).catch(() => {});
  };

  const answer = (requestId: string, a: PermissionAnswer) => void conn.call('chat:answer', chatKey, requestId, a).catch(() => {});
  const stop = () => void conn.call('chat:interrupt', chatKey).catch(() => {});

  const activity = state && running ? activityText(state.activity, state.status) : null;

  return (
    <div className="min-h-full">
      {/* Topo flutuante: voltar e a conta da conversa, o título pequeno no meio. */}
      <FloatingHeader
        title={sessionId && title ? title : undefined}
        subtitle={folder?.name ?? baseName(cwd)}
        onBack={() => back({ name: 'folder', path: cwd })}
        backLabel={folder?.name ?? baseName(cwd)}
        right={<AccountPicker account={account} started={!!sessionId} onChange={changeAccount} circle />}
      />
      <div className={`px-safe ${FLOATING_HEADER_SPACE} pb-[calc(140px+env(safe-area-inset-bottom))]`}>
        {more && (
          <div className="flex justify-center py-3">
            <button type="button" className="text-[15px] text-accent" onClick={() => void load(true).catch(() => {})}>
              {tr('Carregar anteriores', 'Load earlier')}
            </button>
          </div>
        )}
        {sessionId && !loaded && <p className="py-6 text-center text-[15px] text-muted">{tr('Carregando…', 'Loading…')}</p>}
        {!sessionId && !pending.length && !state && (
          <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center px-10">
            {/* O nome da pasta não quebra no meio ("app-" numa linha, "entregas" na outra). */}
            <p className="text-center font-serif text-[26px] leading-tight">
              {tr('O que vamos fazer em ', 'What shall we do in ')}
              <span className="whitespace-nowrap">{folder?.name ?? baseName(cwd)}</span>?
            </p>
          </div>
        )}

        <div className="pt-2">
          {messages.map((m) => (
            <MessageView key={m.id} m={m} cwd={cwd} sessionId={sessionId} footer={footers.get(m.id)} />
          ))}
          {pending.map((p) => (
            <UserBubble key={p.id} text={p.text} images={p.images || undefined} files={p.files} pending />
          ))}
          {state?.queued?.map((q) => (
            <UserBubble key={q.id} text={q.text} pending />
          ))}
          {state?.partial && running && (
            <div className="py-1">
              <MarkdownText text={state.partial} />
            </div>
          )}
          {state?.permissions.map((p) => (
            <PermissionCard key={p.id} request={p} onAnswer={(a) => answer(p.id, a)} />
          ))}
          {state?.error && !running && (
            <p className="my-2 flex items-start gap-1.5 rounded-xl bg-red/10 p-3 text-[15px] text-red">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}
          {activity && (
            <p className="flex items-center gap-2 py-2 text-[15px] text-muted">
              <span className={`inline-block size-2 shrink-0 rounded-full ${state?.status === 'needs-you' ? 'bg-red' : 'animate-pulse-dot bg-orange'}`} />
              <span className="min-w-0 flex-1 truncate">{activity}</span>
              {state?.turnStartedAt ? <span className="shrink-0 tabular-nums">{elapsed(state.turnStartedAt)}</span> : null}
            </p>
          )}
        </div>
      </div>
      <Composer
        busy={running}
        onSend={send}
        onStop={stop}
        disabled={status !== 'online' || !foldersLoaded}
        settings={settings}
        info={info}
        agentChat={agentChat}
        contextPercent={sessionId ? contextPercent : null}
        onSettingsChange={changeSettings}
        onCommand={command}
      />
    </div>
  );
}
