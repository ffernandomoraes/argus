import { useEffect, useState } from 'react';
import { ArrowUp, Folder as FolderIcon, FolderSearch } from 'lucide-react';
import type { FolderListing } from '@argus/shared/phoneChannels';
import type { KnownFolder } from '@argus/shared/sessions';
import { tr } from '../i18n';
import { useWorkspaces } from '../lib/data';
import { useHost } from '../lib/host';
import { back } from '../lib/router';
import { ChoiceSheet } from '../ui/ChoiceSheet';
import { FLOATING_HEADER_SPACE, FloatingHeader } from '../ui/FloatingHeader';
import { ago, baseName } from '../ui/format';
import { Empty, Row, Section } from '../ui/List';
import { SearchField, fold } from '../ui/SearchField';

// Adicionar uma pasta do computador a um workspace: as pastas onde o Claude Code já conversou (as
// mais recentes primeiro, com busca) ou "Procurar no Mac", pasta por pasta a partir da pessoal.
// Escolhida a pasta, o grupo dela no workspace (ou sem grupo). Quem encaixa no canvas é o Argus.

const NO_GROUP = '';

// O caminho com a pasta pessoal como "~" (mais curto no celular).
function shortPath(path: string, home: string | undefined): string {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

// failure: o motivo de não ter lido (Argus antigo no computador, por exemplo).
function useRecentFolders(): { list: KnownFolder[] | null; failure: string | null } {
  const { conn } = useHost();
  const [list, setList] = useState<KnownFolder[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    conn.call('sessions:folders').then(setList, (err: unknown) => {
      setFailure(message(err));
      setList([]);
    });
  }, [conn]);
  return { list, failure };
}

function Browser({ onChoose }: { onChoose: (path: string) => void }) {
  const { conn } = useHost();
  const [path, setPath] = useState<string | null>(null);
  const [listing, setListing] = useState<FolderListing | null | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    setListing(undefined);
    setFailure(null);
    conn.call('folders:list', path).then(setListing, (err: unknown) => {
      setFailure(message(err));
      setListing(null);
    });
  }, [conn, path]);
  if (listing === undefined) return <p className="py-6 text-center text-[14px] text-muted">{tr('Carregando…', 'Loading…')}</p>;
  if (!listing) return <Empty>{failure ?? tr('Não deu para abrir esta pasta.', "Couldn't open this folder.")}</Empty>;
  return (
    <>
      <Section title={shortPath(listing.path, conn.info?.homeDir)}>
        <Row title={<span className="font-semibold text-accent">{tr('Escolher esta pasta', 'Choose this folder')}</span>} chevron={false} onClick={() => onChoose(listing.path)} />
        {listing.parent && <Row icon={<ArrowUp size={20} className="text-faint" />} title={tr('Pasta de cima', 'Parent folder')} onClick={() => setPath(listing.parent)} />}
      </Section>
      <Section>
        {listing.folders.map((f) => (
          <Row key={f.path} icon={<FolderIcon size={20} className="text-faint" />} title={f.name} onClick={() => setPath(f.path)} />
        ))}
        {!listing.folders.length && <Empty>{tr('Sem subpastas.', 'No subfolders.')}</Empty>}
      </Section>
    </>
  );
}

export function AddFolderScreen({ board }: { board: string }) {
  const { conn } = useHost();
  const { workspaces } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === board);
  const { list: recent, failure } = useRecentFolders();
  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const home = conn.info?.homeDir;

  const inWorkspace = new Set(workspace?.groups.flatMap((g) => g.folders.map((f) => f.path)) ?? []);
  const q = fold(query.trim());
  const folders = (recent ?? []).filter((f) => !inWorkspace.has(f.path) && !inWorkspace.has(shortPath(f.path, home)) && (!q || fold(f.path).includes(q)));
  const groups = workspace?.groups.filter((g) => g.id !== NO_GROUP) ?? [];
  const options = [...groups.map((g) => ({ value: g.id, label: g.label || tr('Grupo sem nome', 'Unnamed group') })), { value: NO_GROUP, label: tr('Sem grupo', 'No group') }];

  const add = (path: string, groupId: string) => {
    setBusy(true);
    setError(null);
    conn.call('canvas:addFolder', board, path, groupId || null).then(
      (r) => {
        if (r.ok) return back({ name: 'projects' });
        setError(r.error);
        setBusy(false);
      },
      (err: unknown) => {
        setError(message(err));
        setBusy(false);
      },
    );
  };
  // Sem grupos no workspace, entra direto (fora de grupo); senão, escolhe o grupo.
  const choose = (path: string) => (groups.length ? setChosen(path) : add(path, NO_GROUP));

  return (
    <div className="min-h-full">
      <FloatingHeader title={tr('Adicionar pasta', 'Add folder')} subtitle={workspace?.name} onBack={() => (browsing ? setBrowsing(false) : back({ name: 'projects' }))} backLabel={tr('Projetos', 'Projects')} />
      <div className={`px-safe pb-end ${FLOATING_HEADER_SPACE}`}>
        {error && <p className="mb-2 rounded-xl bg-red/10 p-3 text-[14px] text-red">{error}</p>}
        {busy && <p className="py-2 text-center text-[14px] text-muted">{tr('Adicionando…', 'Adding…')}</p>}
        {browsing ? (
          <Browser onChoose={choose} />
        ) : (
          <>
            <SearchField value={query} onChange={setQuery} placeholder={tr('Buscar nas pastas recentes', 'Search recent folders')} />
            <Section>
              <Row
                icon={<FolderSearch size={20} className="text-accent" />}
                title={conn.info?.platform === 'darwin' ? tr('Procurar no Mac…', 'Browse the Mac…') : tr('Procurar no computador…', 'Browse the computer…')}
                onClick={() => setBrowsing(true)}
              />
            </Section>
            <Section title={tr('Pastas recentes do Claude', 'Recent Claude folders')}>
              {folders.map((f) => (
                <Row
                  key={f.path}
                  icon={<FolderIcon size={20} className="text-faint" />}
                  title={baseName(f.path)}
                  subtitle={shortPath(f.path, home)}
                  trailing={<span className="text-[12px] text-faint">{ago(f.updatedAt)}</span>}
                  onClick={() => choose(f.path)}
                />
              ))}
              {recent === null && <Empty>{tr('Carregando…', 'Loading…')}</Empty>}
              {recent !== null && !folders.length && <Empty>{failure ?? (query ? tr('Nada encontrado.', 'Nothing found.') : tr('Nenhuma pasta recente fora deste workspace.', 'No recent folders outside this workspace.'))}</Empty>}
            </Section>
          </>
        )}
      </div>
      <ChoiceSheet
        open={chosen !== null}
        title={tr('Em qual grupo?', 'Which group?')}
        options={options}
        // Nenhuma marcada: é uma escolha nova.
        value={'\0'}
        onPick={(groupId) => chosen && add(chosen, groupId)}
        onClose={() => setChosen(null)}
      />
    </div>
  );
}
