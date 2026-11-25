import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, BookLock, BookMarked, Loader2, Plus, Search } from 'lucide-react';
import type { GitHubRepo, GitHubRepoList, GitHubStatus } from '@argus/shared/accountGitHub';
import { normalizeRemote } from '@argus/shared/accountWorkspaces';
import { connectErrorText, useGitHubStatus } from '../settings/sections/ProfileGitHub';
import { tr } from '../i18n';
import { TimeAgo } from './blocks/TimeAgo';
import { useGitHubRepos, type Adding } from './useGitHubRepos';

// "Clonar do GitHub", dentro da janela Nova pasta: os repositórios liberados no GitHub conectado à
// conta, do mais mexido para o menos. Escolheu um, escolhe onde pôr; o git clona e a pasta entra no
// canvas como qualquer outra (onCloned). Já clonado neste computador: a linha diz, e escolher abre a
// pasta que existe em vez de clonar de novo. Sem conta, sem GitHub conectado ou sem repositório liberado,
// a tela diz o que falta e oferece o botão para resolver.

type Say = { text: string; action?: { label: string; run: () => void } };

// O que dizer no lugar da lista (carregando, clonando, sem conta, sem GitHub, sem repositório).
// Nulo: mostra a lista.
function stateNotice(o: {
  connecting: boolean
  cloning: string | null
  list: GitHubRepoList | null
  status: GitHubStatus['status'] | null
  empty: boolean
  none: boolean
  installUrl: string | null
  connect: () => void
  retry: () => void
}): Say | null {
  const { list } = o;
  if (o.connecting) return { text: tr('Termine a conexão no navegador e volte para cá.', 'Finish connecting in the browser and come back here.'), action: { label: tr('Cancelar', 'Cancel'), run: () => window.api.account.githubCancel() } };
  if (o.cloning) return { text: tr(`Clonando ${o.cloning}…`, `Cloning ${o.cloning}…`) };
  if (!list) return { text: tr('Buscando seus repositórios…', 'Loading your repositories…') };
  if (!list.ok && list.error === 'signedOut') return { text: tr('Entre na conta do Argus (Configurações > Perfil) para clonar do GitHub.', 'Sign in to your Argus account (Settings > Profile) to clone from GitHub.') };
  if (!list.ok && list.error === 'notConnected' && o.status === 'unavailable') return { text: tr('Clonar do GitHub ainda não está disponível.', 'Cloning from GitHub is not available yet.') };
  if (!list.ok && list.error === 'notConnected') {
    return { text: tr('Conecte o GitHub para ver seus repositórios. Você escolhe quais o Argus vê, só para leitura.', 'Connect GitHub to see your repositories. You choose which ones Argus sees, read-only.'), action: { label: tr('Conectar GitHub', 'Connect GitHub'), run: o.connect } };
  }
  if (!list.ok && list.error === 'failed') return { text: tr('O servidor da conta não respondeu direito. Tente de novo daqui a pouco.', "The account server didn't respond properly. Try again in a moment."), action: { label: tr('Tentar de novo', 'Try again'), run: o.retry } };
  if (!list.ok) return { text: tr('Não deu para buscar agora. Confira a internet.', "Couldn't load right now. Check your connection."), action: { label: tr('Tentar de novo', 'Try again'), run: o.retry } };
  const installUrl = o.installUrl;
  if (o.empty) return { text: tr('Nenhum repositório liberado ainda.', 'No repositories allowed yet.'), ...(installUrl && { action: { label: tr('Escolher repositórios', 'Choose repositories'), run: () => window.open(installUrl) } }) };
  if (o.none) return { text: tr('Nenhum repositório com esse nome.', 'No repository with that name.') };
  return null;
}

function Notice({ text, action }: Say) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-4 text-xs text-muted">
      <p>{text}</p>
      {action && (
        <button onClick={action.run} className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90">
          {action.label}
        </button>
      )}
    </div>
  );
}

const CHIP = 'shrink-0 rounded-full border px-2.5 py-0.5 text-xs';

// A conta e as organizações dos repositórios liberados, para ver só os de uma, e "+ Outra
// organização": a instalação do app no GitHub, onde a pessoa escolhe outra conta ou organização (ou
// mais repositórios). Enquanto isso, o botão gira: esperando o navegador e, na volta, buscando a lista.
function OwnerChips({
  owners,
  value,
  onChange,
  installUrl,
  adding,
  onAdd,
  onStopAdding,
}: {
  owners: string[]
  value: string | null
  onChange: (owner: string | null) => void
  installUrl: string | null
  adding: Adding
  onAdd: (installUrl: string) => void
  onStopAdding: () => void
}) {
  const chip = (label: string, owner: string | null) => (
    <button
      key={owner ?? ''}
      onClick={() => onChange(owner)}
      className={`${CHIP} ${value === owner || owners.length === 1 ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:text-text'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
      {owners.length > 1 && chip(tr('Todas', 'All'), null)}
      {owners.map((o) => chip(o, o))}
      {adding ? (
        <button
          onClick={onStopAdding}
          title={tr('Parar de esperar', 'Stop waiting')}
          className={`${CHIP} flex items-center gap-1 border-accent text-text`}
        >
          <Loader2 size={12} className="animate-spin" />
          {adding === 'browser' ? tr('Esperando o GitHub…', 'Waiting for GitHub…') : tr('Buscando repositórios…', 'Loading repositories…')}
        </button>
      ) : (
        installUrl && (
          <button onClick={() => onAdd(installUrl)} className={`${CHIP} flex items-center gap-1 border-dashed border-line text-muted hover:text-text`}>
            <Plus size={12} />
            {tr('Outra organização', 'Another organization')}
          </button>
        )
      )}
    </div>
  );
}

export function GitHubClone({ onCloned, onBack }: { onCloned: (folder: string) => void; onBack: () => void }) {
  const [status, reloadStatus] = useGitHubStatus();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [cloning, setCloning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Só os repositórios desta conta ou organização (nulo: todas).
  const [owner, setOwner] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Já clonados neste computador: endereço normalizado -> pasta (vem depois da lista, sem segurar).
  const [clones, setClones] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void window.api.gitLocalClones().then((c) => alive && setClones(c), () => {});
    return () => {
      alive = false;
    };
  }, []);
  const localOf = (repo: GitHubRepo): string | null => {
    const key = normalizeRemote(repo.cloneUrl);
    return (key && clones[key]) || null;
  };
  const { list, load, adding, startAdding, stopAdding } = useGitHubRepos((fresh) => {
    setOwner(fresh);
    setHighlight(0);
  });

  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const repos = list?.ok ? list.repos : [];
  const q = query.trim().toLowerCase();
  const shown = repos.filter((r) => (!owner || r.owner === owner) && (!q || r.fullName.toLowerCase().includes(q)));
  const login = status?.status === 'connected' ? status.login : null;
  const installUrl = status?.status === 'connected' ? status.installUrl : null;
  // A conta da pessoa primeiro, depois as organizações em ordem alfabética.
  const owners = [...new Set(repos.map((r) => r.owner))].sort((a, b) => (a === login ? -1 : b === login ? 1 : a.localeCompare(b)));

  const clone = async (repo: GitHubRepo) => {
    if (cloning) return;
    const here = localOf(repo);
    if (here) return onCloned(here);
    const parent = await window.api.pickCloneParent();
    if (!parent) return;
    setCloning(repo.fullName);
    setMessage(null);
    const r = await window.api.gitClone(repo.cloneUrl, parent, repo.name);
    setCloning(null);
    if (r.ok) onCloned(r.path);
    else setMessage(r.error);
  };

  const connect = async () => {
    setConnecting(true);
    setMessage(null);
    const r = await window.api.account.githubConnect();
    setConnecting(false);
    setMessage(connectErrorText(r));
    reloadStatus();
    load();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, shown.length - 1));
    else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0));
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing && shown[highlight]) void clone(shown[highlight]);
    else return;
    e.preventDefault();
  };

  const say = stateNotice({ connecting, cloning, list, status: status?.status ?? null, empty: !repos.length, none: !shown.length, installUrl, connect: () => void connect(), retry: load });
  const body = say ? (
    <Notice {...say} />
  ) : (
    <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
      {shown.map((r, i) => (
        <RepoRow key={r.fullName} repo={r} local={localOf(r)} index={i} highlighted={i === highlight} onPick={(repo) => void clone(repo)} onHighlight={setHighlight} />
      ))}
    </ul>
  );

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <button onClick={onBack} aria-label={tr('Voltar', 'Back')} className="shrink-0 text-muted hover:text-text">
          <ArrowLeft size={15} />
        </button>
        <Search size={15} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={tr('Buscar repositório do GitHub', 'Search GitHub repositories')}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>
      {repos.length > 0 && !connecting && !cloning && (
        <OwnerChips
          owners={owners}
          value={owner}
          onChange={(o) => {
            setOwner(o);
            setHighlight(0);
          }}
          installUrl={installUrl}
          adding={adding}
          onAdd={startAdding}
          onStopAdding={stopAdding}
        />
      )}
      {body}
      {message && <p className="shrink-0 border-t border-line px-3 py-2.5 text-xs text-red-400">{message}</p>}
    </>
  );
}

const RepoRow = memo(function RepoRow({
  repo,
  local,
  index,
  highlighted,
  onPick,
  onHighlight,
}: {
  repo: GitHubRepo
  // A pasta do clone que já existe neste computador.
  local: string | null
  index: number
  highlighted: boolean
  onPick: (repo: GitHubRepo) => void
  onHighlight: (index: number) => void
}) {
  const Icon = repo.private ? BookLock : BookMarked;
  return (
    <li>
      <button
        onClick={() => onPick(repo)}
        onMouseMove={() => onHighlight(index)}
        title={local ? tr(`Já clonado em ${local}`, `Already cloned at ${local}`) : (repo.description ?? repo.fullName)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${highlighted ? 'bg-accent [&_span]:text-white [&_svg]:text-white' : ''}`}
      >
        <Icon size={14} className="shrink-0 text-muted" />
        <span className="shrink-0 font-medium text-text">{repo.name}</span>
        <span className="min-w-0 truncate text-faint">{repo.owner}</span>
        {local && <span className="shrink-0 rounded-full border border-line px-1.5 text-[11px] text-faint">{tr('neste computador', 'on this computer')}</span>}
        {repo.pushedAt && <TimeAgo iso={new Date(repo.pushedAt).toISOString()} className="pl-2" />}
      </button>
    </li>
  );
});
