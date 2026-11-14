import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FLOATING_HEADER_SPACE, FloatingHeader } from '../ui/FloatingHeader';
import type { ChatSettings, PermissionAnswer } from '@argus/shared/chat';
import type { AttachedFile } from '@argus/shared/attachedFiles';
import type { Message } from '@argus/shared/history';
import { Composer, type Draft } from '../chat/Composer';
import { ChatTimeline, type Pending } from '../chat/ChatTimeline';
import { ScrollToEndButton } from '../chat/ScrollToEndButton';
import { WorkingLine } from '../chat/WorkingLine';
import { reuseMessages } from '../chat/reuseMessages';
import { fetchHistory } from '../chat/fetchHistory';
import { scrollToEnd, useStickToBottom } from '../chat/useStickToBottom';
import { turnFooters } from '../chat/turnFooters';
import { tr } from '../i18n';
import { useAgentInfo, useAuthState, useBranch, useChatDetails, useChatState, useProvidersState, useSessions, useUnread, useWorkspaces } from '../lib/data';
import { parseAgentRef } from '@argus/shared/providers';
import { AccountPicker, resolveAccount } from '../chat/AccountPicker';
import { DEFAULT_SETTINGS, loadPrefs, movePrefs, savePrefs } from '../chat/options';
import { newChatId } from './FolderScreen';
import { useHost, useStatus } from '../lib/host';
import { TextSheet } from '../ui/TextSheet';
import { usePreferences } from '../lib/usePreferences';
import { useWindowColor } from '../lib/windowColor';
import { imageForSend, isImage } from '../lib/images';
import { cacheGet, cacheSet } from '../lib/cache';
import { back, go, replace } from '../lib/router';
import { baseName } from '../ui/format';

// Uma conversa: o histórico, o que o agente está fazendo agora, os pedidos de permissão e a caixa de
// escrever, com a conta na barra do topo e modelo/esforço/modo/contexto/comandos em cima da caixa.
// Conversa nova ("new-...") vira a da sessão assim que o agente a grava.

const PAGE = 40;

// Último histórico lido de cada conversa (na memória e no aparelho, ver lib/cache.ts): reabrir
// mostra na hora e atualiza por baixo.
type SavedHistory = { messages: Message[]; more: boolean };
const savedHistory = (sessionId: string) => cacheGet<SavedHistory>(`history:${sessionId}`);


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
  // Escolhido nesta conversa (aqui ou na janela do Argus); sem escolha, o padrão das Configurações do
  // Argus, como as conversas novas de lá.
  const [chosenSettings, setChosenSettings] = useState<ChatSettings | null>(() => loadPrefs(prefsId).settings ?? null);
  const prefs = usePreferences();
  useWindowColor(folder?.group?.color);
  const branch = useBranch(cwd);
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
    if (details?.settings) setChosenSettings(details.settings);
  }, [details]);
  // O padrão (de Conta > Preferências, herdado do Argus) vale nas conversas do Claude; as de outros
  // agentes ficam no padrão deles.
  const settings = chosenSettings ?? (!agentChat && prefs.conversation ? prefs.conversation : DEFAULT_SETTINGS);
  // Conversa nova gravada: o que foi escolhido nela vai para o id da sessão.
  useEffect(() => {
    if (sessionId && chatKey !== sessionId) movePrefs(chatKey, sessionId);
  }, [sessionId, chatKey]);

  const changeSettings = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setChosenSettings(next);
    savePrefs(prefsId, { settings: next });
    // Aberta no Argus: a troca vale já (como nos seletores de lá).
    if (state) void conn.call('chat:configure', chatKey, patch).catch(() => {});
  };
  const changeAccount = (a: string) => {
    setChosenAccount(a);
    savePrefs(prefsId, { account: a });
  };

  // Aberta aqui (o app só fala com o Argus com a tela acesa): vista, some a bolinha verde das
  // listas, aqui e no Argus. Também quando termina com ela na tela.
  const unread = useUnread();
  const isUnread = !!sessionId && unread.ids.has(sessionId);
  useEffect(() => {
    if (isUnread && sessionId) unread.markRead(sessionId);
  }, [isUnread, sessionId]);

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
  // As da tela agora: o pedido do histórico manda o que já tem (ver fetchHistory).
  const shown = useRef(messages);
  shown.current = messages;
  const [more, setMore] = useState(cached?.more ?? false);
  const [loaded, setLoaded] = useState(!!cached);
  const count = useRef(PAGE);
  const first = useRef<string | undefined>(undefined);
  const shownSession = useRef(sessionId);
  shownSession.current = sessionId;
  const stick = useStickToBottom();

  const load = useCallback(
    async (older = false) => {
      if (!sessionId) return;
      if (older) count.current += PAGE;
      const page = await fetchHistory(conn, {
        cwd,
        id: sessionId,
        request: { since: older ? undefined : first.current, count: count.current },
        known: shown.current,
      });
      // Trocou de conversa enquanto lia: esta leitura é da anterior.
      if (shownSession.current !== sessionId) return;
      first.current = page.messages[0]?.id;
      count.current = Math.max(count.current, page.messages.length);
      if (older) stick.current = false;
      cacheSet(`history:${sessionId}`, page);
      setMessages((prev) => reuseMessages(prev, page.messages));
      setMore(page.more);
      setLoaded(true);
    },
    [conn, cwd, sessionId, stick],
  );

  useEffect(() => {
    first.current = undefined;
    count.current = PAGE;
    const saved = sessionId ? savedHistory(sessionId) : undefined;
    setMessages(saved?.messages ?? []);
    setMore(saved?.more ?? false);
    setLoaded(!sessionId || !!saved);
    stick.current = true;
  }, [sessionId, stick]);

  // Uma leitura por vez. Os avisos chegam várias vezes por segundo enquanto o agente trabalha (a
  // revisão da conversa e cada gravação do arquivo); antes, cada um pedia o histórico inteiro de
  // novo e o celular travava. Os que chegam no meio viram uma leitura só, logo depois.
  const reading = useRef(false);
  const readAgain = useRef(false);
  const refresh = useCallback(() => {
    if (reading.current) {
      readAgain.current = true;
      return;
    }
    reading.current = true;
    void load()
      .catch(() => {})
      .finally(() => {
        reading.current = false;
        if (!readAgain.current) return;
        readAgain.current = false;
        setTimeout(() => latestRefresh.current(), 300);
      });
  }, [load]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;

  const revision = state?.revision ?? 0;
  useEffect(() => {
    if (status === 'online') refresh();
  }, [refresh, revision, epoch, status]);
  // Sem sessão aberta aqui (a conversa roda num terminal, por exemplo), o arquivo avisa.
  useEffect(() => conn.on('sessions:changed', (p, change) => p === cwd && change === 'transcript' && refresh()), [conn, cwd, refresh]);

  // --- Mensagens enviadas que ainda não estão no histórico ---
  // O balão aparece na hora do envio e fica até a mensagem estar no histórico. Antes, saía assim que
  // ela entrava na fila do Argus, e entre sair da fila e chegar ao histórico o balão sumia e voltava.
  const [pending, setPending] = useState<Pending[]>([]);
  const [renaming, setRenaming] = useState(false);
  const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
  const sameText = (a: string, b: string) => squash(a).startsWith(squash(b).slice(0, 40));
  useEffect(() => {
    if (!pending.length) return;
    const users = messages.filter((m) => m.role === 'user').slice(-10);
    setPending((prev) => prev.filter((p) => Date.now() - p.at < 60_000 && !users.some((u) => u.role === 'user' && sameText(u.text, p.text))));
  }, [messages]);
  // Mandada com o agente trabalhando, a mensagem fica na fila do Argus até o pedido acabar, mas já
  // entra no histórico antes: a da fila só aparece enquanto ainda não está lá (antes, ficava repetida
  // no fim, descendo a cada passo). Na fila, o balão é o dela (sem repetir o daqui).
  const recentUsers = messages.filter((m) => m.role === 'user').slice(-10);
  const queued = (state?.queued ?? []).filter((q) => !recentUsers.some((u) => sameText(u.text, q.text)));
  const shownPending = pending.filter((p) => !queued.some((q) => sameText(q.text, p.text)));

  // Altura da caixa de escrever: a conversa reserva esse espaço embaixo e, no fim, sobe junto quando a
  // caixa cresce (a sugestão aparecendo, por exemplo).
  const [composerHeight, setComposerHeight] = useState(110);

  // Rola até o fim ao abrir e quando chega coisa nova com você já embaixo.
  useLayoutEffect(() => {
    if (stick.current) scrollToEnd();
  }, [messages, pending, state?.partial, state?.permissions.length, composerHeight, stick]);

  const running = state?.status === 'running' || state?.status === 'needs-you';
  // Rodapé de cada pedido (hora, quanto levou, tokens) na última resposta dele, como no Argus.
  const footers = useMemo(() => turnFooters(messages, running), [messages, running]);
  useTicker(!!state?.turnStartedAt && running);

  const send = async ({ text, files }: Draft) => {
    const others = files.filter((f) => !isImage(f));
    const id = Date.now();
    stick.current = true;
    // Miniaturas da mensagem a caminho, das próprias imagens; soltas depois que ela já virou histórico
    // (a fila tira a mensagem em até 60 s).
    const imageUrls = files.filter(isImage).map((f) => URL.createObjectURL(f));
    setTimeout(() => imageUrls.forEach((u) => URL.revokeObjectURL(u)), 70_000);
    setPending((p) => [...p, { id, text, images: imageUrls.length, imageUrls, files: others.map((f) => f.name), at: id }]);
    try {
      await deliver(text, files);
    } catch (err) {
      setPending((p) => p.filter((x) => x.id !== id));
      throw err;
    }
  };

  const deliver = async (text: string, files: File[]) => {
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
  };

  const command = (name: 'compact' | 'clear' | 'rename') => {
    if (name === 'clear') return go({ name: 'chat', cwd, id: newChatId() });
    if (name === 'compact') return void send({ text: '/compact', files: [] }).catch(() => {});
    if (sessionId) setRenaming(true);
  };
  const rename = (next: string) => {
    if (sessionId) void conn.call('chat:rename', { key: chatKey, cwd, sessionId, title: next }).catch(() => {});
  };

  const answer = (requestId: string, a: PermissionAnswer) => void conn.call('chat:answer', chatKey, requestId, a).catch(() => {});
  const stop = () => void conn.call('chat:interrupt', chatKey).catch(() => {});


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
      {/* A conversa termina logo acima da caixa de escrever (pela altura medida dela). */}
      <div className={`px-safe ${FLOATING_HEADER_SPACE}`} style={{ paddingBottom: composerHeight + 12 }}>
        {more && (
          <div className="flex justify-center py-3">
            <button type="button" className="text-[14px] text-accent" onClick={() => void load(true).catch(() => {})}>
              {tr('Carregar anteriores', 'Load earlier')}
            </button>
          </div>
        )}
        {sessionId && !loaded && <p className="py-6 text-center text-[14px] text-muted">{tr('Carregando…', 'Loading…')}</p>}
        {!sessionId && !pending.length && !state && (
          <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center px-10">
            {/* O nome da pasta não quebra no meio ("app-" numa linha, "entregas" na outra). */}
            <p className="text-center font-serif text-[24px] leading-tight">
              {tr('O que vamos fazer em ', 'What shall we do in ')}
              <span className="whitespace-nowrap">{folder?.name ?? baseName(cwd)}</span>?
            </p>
          </div>
        )}

        <ChatTimeline
          messages={messages}
          cwd={cwd}
          sessionId={sessionId}
          footers={footers}
          running={running}
          pending={shownPending}
          queued={queued}
          state={state}
          onAnswer={answer}
        />
      </div>
      <ScrollToEndButton stick={stick} bottom={composerHeight + 12} />
      <Composer
        busy={running}
        onSend={send}
        onStop={stop}
        disabled={status !== 'online' || !foldersLoaded}
        settings={settings}
        info={info}
        agentChat={agentChat}
        contextPercent={sessionId ? contextPercent : null}
        branch={branch}
        suggestion={prefs.suggestions ? state?.suggestion : undefined}
        working={state && running ? <WorkingLine state={state} /> : undefined}
        onSettingsChange={changeSettings}
        onCommand={command}
        onHeight={setComposerHeight}
      />
      <TextSheet
        open={renaming}
        title={tr('Renomear conversa', 'Rename chat')}
        placeholder={tr('Nome da conversa', 'Chat name')}
        initial={title}
        confirmLabel={tr('Salvar', 'Save')}
        onConfirm={rename}
        onClose={() => setRenaming(false)}
      />
    </div>
  );
}
