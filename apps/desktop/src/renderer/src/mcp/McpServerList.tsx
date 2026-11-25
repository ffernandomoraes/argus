import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Lock, Power, type LucideIcon } from 'lucide-react';
import type { McpServer } from '@argus/shared/mcp';
import { ConfirmDialog, type ConfirmRequest } from '../canvas/ConfirmDialog';
import { tr } from '../i18n';
import { McpEmpty } from './McpEmpty';
import { pluginOf, ServerRow, type useMcpServers } from './McpServers';
import { serverLabel } from './serverLabel';

// A lista de servidores MCP agrupada por estado, com as mensagens de carregando, erro e lista vazia.
// Usada no painel do /mcp da conversa (panel) e em Configurações > MCP (cards).

// Como cada estado aparece. A ordem aqui é a ordem das seções na lista.
const GROUPS = [
  { status: 'connected', label: tr('Conectados', 'Connected'), icon: Check, tone: 'text-emerald-400' },
  { status: 'needs-auth', label: tr('Precisam de autorização', 'Need authorization'), icon: Lock, tone: 'text-needs-you' },
  { status: 'failed', label: tr('Com erro', 'Failed'), icon: AlertTriangle, tone: 'text-red-400' },
  { status: 'pending', label: tr('Conectando', 'Connecting'), icon: Loader2, tone: 'text-running' },
  { status: 'disabled', label: tr('Desligados', 'Disabled'), icon: Power, tone: 'text-faint' },
] as const;

const HINT: Partial<Record<McpServer['status'], string>> = {
  'needs-auth': tr(
    'Clique em Autorizar: o navegador abre na página do serviço e, ao terminar lá, ele conecta sozinho.',
    'Click Authorize: the browser opens the service’s page and, once you finish there, it connects on its own.',
  ),
  failed: tr('O Claude não conseguiu conectar. Veja o erro de cada um abaixo.', 'Claude couldn’t connect. See each error below.'),
};

export function McpServerList({
  state,
  empty,
  notLive,
  variant = 'panel',
}: {
  state: ReturnType<typeof useMcpServers>
  empty: string
  notLive?: string
  // cards: cada grupo num bloco com fundo e divisória entre os servidores (Configurações > MCP).
  variant?: 'panel' | 'cards'
}) {
  const { status, servers, live, loading } = state;
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  // Grupos abertos. Começa só com os conectados: os outros (erro, autorização, conectando,
  // desligados) ficam fechados, com o número à vista, até alguém abrir.
  const [open, setOpen] = useState<ReadonlySet<McpServer['status']>>(new Set(['connected']));
  const toggle = (s: McpServer['status']) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(s)) next.add(s);
      return next;
    });

  const askSignOut = (server: McpServer) =>
    setConfirm({
      title: tr(`Desconectar ${serverLabel(server).name}?`, `Sign out of ${serverLabel(server).name}?`),
      description: tr(
        'O login dele sai desta conta do Claude, em todas as conversas. Para usar de novo, é só autorizar outra vez.',
        'Its login is removed from this Claude account, in every chat. To use it again, just authorize it again.',
      ),
      confirmLabel: tr('Desconectar', 'Sign out'),
      onConfirm: () => state.signOut(server.name),
    });

  // Os de projeto ficam no .mcp.json da pasta, que costuma ir para o git: valem para todo mundo.
  const askRemove = (server: McpServer) =>
    setConfirm({
      title: tr(`Remover ${serverLabel(server).name}?`, `Remove ${serverLabel(server).name}?`),
      description:
        server.source === 'plugin'
          ? tr(
              `Ele vem do plugin ${pluginOf(server)}: o plugin inteiro é desinstalado, com o que mais ele traz (skills, comandos, agentes). Para voltar, é preciso instalar de novo.`,
              `It comes from the ${pluginOf(server)} plugin: the whole plugin is uninstalled, along with whatever else it brings (skills, commands, agents). To bring it back, install it again.`,
            )
          : server.scope === 'project'
          ? tr(
              'Ele sai do .mcp.json desta pasta, e some para todo mundo que usa o projeto. Para voltar, é preciso adicionar de novo.',
              'It’s removed from this folder’s .mcp.json, for everyone who uses the project. To bring it back, add it again.',
            )
          : tr(
              'Ele sai da configuração desta conta do Claude. Conversas já abertas ainda o usam até reabrir. Para voltar, é preciso adicionar de novo.',
              'It’s removed from this Claude account’s settings. Chats already open keep it until they reopen. To bring it back, add it again.',
            ),
      confirmLabel: tr('Remover', 'Remove'),
      onConfirm: () => state.remove(server.name, server.scope ?? ''),
    });

  return (
    <>
      {loading && servers.length === 0 && (
        <p className="flex items-center justify-center gap-2 py-8 text-[15px] text-faint">
          <Loader2 size={13} className="animate-spin" />
          {tr('Perguntando aos servidores…', 'Asking the servers…')}
        </p>
      )}
      {status && !status.ok && <p className="px-2 py-4 text-[15px] text-red-400">{status.error}</p>}
      {state.actionError && <p className="px-2 pb-3 text-[15px] text-red-400">{state.actionError}</p>}
      {status?.ok && !live && servers.length > 0 && notLive && <p className="mb-3 px-2 text-[15px] leading-snug text-faint">{notLive}</p>}
      {status?.ok && servers.length === 0 && !loading && <McpEmpty title={empty} />}
      {GROUPS.map(({ status: s, label, icon: Icon, tone }) => {
        // Pelo nome que aparece: sem o prefixo, os do claude.ai e os de plugin se misturam aos outros.
        const list = servers.filter((x) => x.status === s).sort((a, b) => serverLabel(a).name.localeCompare(serverLabel(b).name));
        if (!list.length) return null;
        const expanded = open.has(s);
        const rows = list.map((server) => (
          <ServerRow
            key={server.name}
            server={server}
            reconnecting={state.reconnecting.has(server.name)}
            authorizing={state.authorizing.has(server.name)}
            onPasteBack={state.pasting.has(server.name) ? (url) => state.submitCallback(server.name, url) : undefined}
            {...(live && {
              onReconnect: () => state.reconnect(server.name),
              onAuthorize: () => state.authorize(server.name),
              onSignOut: () => askSignOut(server),
            })}
            // Remover não precisa do `claude` aberto: é pelo comando dele.
            onRemove={() => askRemove(server)}
          />
        ));
        const group = { key: s, label, icon: Icon, tone, count: list.length, expanded, hint: HINT[s], spin: s === 'pending', onToggle: () => toggle(s) };
        return variant === 'cards' ? <CardGroup {...group}>{rows}</CardGroup> : <PanelGroup {...group}>{rows}</PanelGroup>;
      })}
      {confirm && <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />}
    </>
  );
}

type GroupProps = {
  label: string
  icon: LucideIcon
  tone: string
  count: number
  expanded: boolean
  hint?: string
  spin: boolean
  onToggle: () => void
  children: ReactNode
};

// Painel da conversa: título pequeno em caixa alta, servidores sem divisória.
function PanelGroup({ label, icon: Icon, tone, count, expanded, hint, spin, onToggle, children }: GroupProps) {
  return (
    <section className="mb-2 last:mb-0">
      <button onClick={onToggle} aria-expanded={expanded} className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface-2">
        <Icon size={12} className={`shrink-0 ${tone} ${spin ? 'animate-spin' : ''}`} />
        <span className="text-[15px] font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="text-[15px] text-faint">{count}</span>
        <ChevronRight size={14} className={`ml-auto shrink-0 text-faint transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && hint && <p className="mb-1 px-2 text-[15px] leading-snug text-faint">{hint}</p>}
      <ul className={`mb-2 flex flex-col ${expanded ? '' : 'hidden'}`}>{children}</ul>
    </section>
  );
}

// Configurações: cada grupo num bloco com fundo (como Perfil > Instruções e skills), seta à direita e
// divisória tracejada entre os servidores.
function CardGroup({ label, icon: Icon, tone, count, expanded, hint, spin, onToggle, children }: GroupProps) {
  return (
    <section className="mb-3 rounded-xl bg-fill px-5">
      <button onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-2 py-4 text-left">
        <Icon size={15} className={`shrink-0 ${tone} ${spin ? 'animate-spin' : ''}`} />
        <span className="text-[16px] text-text">{label}</span>
        <span className="text-[15px] text-muted">{count}</span>
        <ChevronDown size={18} className={`ml-auto shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && hint && <p className="-mt-2 pb-3 text-[15px] leading-relaxed text-muted">{hint}</p>}
      {expanded && (
        <ul className="flex flex-col border-t border-dashed border-line [&>li+li]:border-t [&>li+li]:border-dashed [&>li+li]:border-line [&>li:hover]:bg-transparent [&>li]:rounded-none [&>li]:px-0 [&>li]:py-3">
          {children}
        </ul>
      )}
    </section>
  );
}
