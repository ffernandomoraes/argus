import { useState } from 'react';
import { Folder as FolderIcon, FolderPlus, GitBranch, LayoutGrid, Plus } from 'lucide-react';
import { tr } from '../i18n';
import { useWorkspaces, type Workspace } from '../lib/data';
import { useHost } from '../lib/host';
import { Sheet } from '../ui/Sheet';
import { TextSheet } from '../ui/TextSheet';
import { go } from '../lib/router';
import { GroupLabel } from '../ui/GroupLabel';
import { Empty, Row, Section } from '../ui/List';
import { TabHeader } from '../ui/TabBar';
import { ROUND_BUTTON } from '../ui/FloatingHeader';

// Aba Projetos: as pastas do canvas do Argus, nos grupos de lá (pílula na cor do grupo). Com mais de
// um workspace, etiquetas embaixo do título trocam entre eles (rolam para o lado quando não cabem);
// o escolhido fica guardado neste aparelho.

const KEY = 'argus-projects-workspace';

function savedWorkspace(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function WorkspaceTags({ workspaces, current, onPick }: { workspaces: Workspace[]; current: string; onPick: (id: string) => void }) {
  return (
    // Até a borda da tela ao rolar (o -mx desfaz a margem da página), começando na margem do título.
    <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {workspaces.map((w) => {
        const on = w.id === current;
        return (
          <button
            key={w.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(w.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium whitespace-nowrap active:opacity-60 ${on ? 'bg-text text-bg' : 'bg-code text-muted'}`}
          >
            {w.name}
          </button>
        );
      })}
    </div>
  );
}

function AddMenu({ open, onClose, onAddFolder, onNewWorkspace }: { open: boolean; onClose: () => void; onAddFolder?: () => void; onNewWorkspace: () => void }) {
  const item = 'flex w-full items-center gap-3 border-b border-line px-4 py-[13px] text-left text-[15px] last:border-0 active:bg-card-press';
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">
        {onAddFolder && (
          <button type="button" className={item} onClick={() => {
              onClose();
              onAddFolder();
            }}>
            <FolderPlus size={20} className="text-muted" />
            {tr('Adicionar pasta', 'Add folder')}
          </button>
        )}
        <button type="button" className={item} onClick={() => {
            onClose();
            onNewWorkspace();
          }}>
          <LayoutGrid size={20} className="text-muted" />
          {tr('Novo workspace', 'New workspace')}
        </button>
      </div>
    </Sheet>
  );
}

export function ProjectsScreen() {
  const { conn } = useHost();
  const { workspaces, loaded } = useWorkspaces();
  const [menu, setMenu] = useState(false);
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(savedWorkspace);
  // O guardado que não existe mais (workspace fechado no Argus): o primeiro.
  const current = workspaces.find((w) => w.id === picked) ?? workspaces[0];
  const pick = (id: string) => {
    setPicked(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // sem armazenamento: vale até fechar o app
    }
  };

  const createWorkspace = (name: string) => {
    setError(null);
    conn.call('boards:create', name).then(pick, (err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };
  const groups = current?.groups.filter((g) => g.folders.length) ?? [];

  return (
    <div className="px-safe pb-tabs min-h-full">
      <TabHeader
        title={tr('Projetos', 'Projects')}
        action={
          <button type="button" onClick={() => setMenu(true)} aria-label={tr('Adicionar', 'Add')} className={ROUND_BUTTON}>
            <Plus size={22} />
          </button>
        }
      >
        {workspaces.length > 1 && current && <WorkspaceTags workspaces={workspaces} current={current.id} onPick={pick} />}
      </TabHeader>
      {error && <p className="mt-2 px-1 text-[12px] text-red">{error}</p>}
      {groups.map((g) => (
        <Section key={`${current.id}:${g.id}`} flush title={<GroupLabel label={g.label || tr('Sem grupo', 'No group')} color={g.color} />}>
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
      ))}
      {loaded && current && !groups.length && (
        <Section>
          <Empty>{tr('Nenhuma pasta neste workspace. Toque no + para adicionar.', 'No folders in this workspace. Tap + to add one.')}</Empty>
        </Section>
      )}
      <AddMenu open={menu} onClose={() => setMenu(false)} onAddFolder={current ? () => go({ name: 'addFolder', board: current.id }) : undefined} onNewWorkspace={() => setNaming(true)} />
      <TextSheet
        open={naming}
        title={tr('Novo workspace', 'New workspace')}
        placeholder={tr('Nome do workspace', 'Workspace name')}
        confirmLabel={tr('Criar', 'Create')}
        onConfirm={createWorkspace}
        onClose={() => setNaming(false)}
      />
      {loaded && workspaces.length === 0 && (
        <Section>
          <Empty>{tr('Nenhuma pasta no canvas do Argus ainda.', 'No folders on the Argus canvas yet.')}</Empty>
        </Section>
      )}
    </div>
  );
}
