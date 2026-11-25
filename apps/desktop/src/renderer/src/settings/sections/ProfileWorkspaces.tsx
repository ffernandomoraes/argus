import { useEffect, useState } from 'react';
import type { AccountBoardSummary, AccountComputer, WorkspaceImportResult } from '@argus/shared/accountWorkspaces';
import { relativeTime } from '../../canvas/relativeTime';
import { tr } from '../../i18n';
import { EmptyState } from '../../ui/emptyState/EmptyState';
import { WorkspacesArt } from '../../ui/emptyState/illustrations';
import { Button } from '../../ui/Button';
import { useModalClose } from '../../ui/modalContext';
import { Group, Row } from '../controls';
import { platformName } from './ProfileDevices';

// Perfil > Workspaces: os workspaces dos outros computadores da conta, para importar uma cópia para
// cá (item 1e). Nada entra sozinho: o computador do trabalho e o de casa podem ter projetos
// diferentes. Os daqui vão para a conta sozinhos. Pasta que não for achada neste computador fica com
// "Pasta não encontrada" no card, com "Clonar…" e "Localizar pasta…".

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function contents(b: AccountBoardSummary): string {
  const parts = [
    b.folders ? plural(b.folders, tr('pasta', 'folder'), tr('pastas', 'folders')) : '',
    b.groups ? plural(b.groups, tr('grupo', 'group'), tr('grupos', 'groups')) : '',
    b.notes ? plural(b.notes, tr('nota', 'note'), tr('notas', 'notes')) : '',
  ].filter(Boolean);
  return parts.join(', ');
}

function resultText(r: WorkspaceImportResult): string {
  if (!r.ok) {
    return r.error === 'notFound'
      ? tr('Esse workspace não está mais na conta. Abra o Argus no outro computador para mandar de novo.', "That workspace isn't in the account anymore. Open Argus on the other computer to send it again.")
      : tr('Não deu para importar agora. Confira a internet e tente de novo.', "Couldn't import it right now. Check your connection and try again.");
  }
  const name = tr(`Criado o workspace "${r.name}".`, `Created the workspace "${r.name}".`);
  if (!r.missing) return `${name} ${tr('Todas as pastas foram achadas aqui.', 'All folders were found here.')}`;
  return `${name} ${tr(
    `${plural(r.missing, 'pasta não está', 'pastas não estão')} neste computador: o card oferece "Clonar…" ou "Localizar pasta…".`,
    `${plural(r.missing, 'folder is', 'folders are')} not on this computer: the card offers "Clone…" or "Locate folder…".`,
  )}`;
}

function BoardRow({ computer, board }: { computer: AccountComputer; board: AccountBoardSummary }) {
  const close = useModalClose();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WorkspaceImportResult | null>(null);
  const bring = async () => {
    setBusy(true);
    setResult(await window.api.account.importWorkspace(computer.id, board.id));
    setBusy(false);
  };
  const open = (id: string) => {
    window.api.boards.show(id);
    close('button');
  };
  return (
    <Row label={board.name} description={result ? resultText(result) : contents(board)}>
      {result?.ok ? (
        <Button variant="primary" onClick={() => open(result.board)}>
          {tr('Abrir', 'Open')}
        </Button>
      ) : (
        <Button disabled={busy} onClick={() => void bring()}>
          {busy ? tr('Importando…', 'Importing…') : tr('Importar', 'Import')}
        </Button>
      )}
    </Row>
  );
}

const intro = () =>
  tr(
    'Importe só os workspaces que quiser aqui. Cada um vira um workspace novo neste computador, sem ligação com o original. Os arquivos dos projetos não vêm: pasta que não existir aqui fica com "Clonar…" ou "Localizar pasta…".',
    'Import only the workspaces you want here. Each one becomes a new workspace on this computer, not linked to the original. Project files do not come: a folder missing here gets "Clone…" or "Locate folder…".',
  );

export function ProfileWorkspaces() {
  const [computers, setComputers] = useState<AccountComputer[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void window.api.account.computers().then((list) => alive && setComputers(list));
    return () => {
      alive = false;
    };
  }, []);

  const note = (text: string) => (
    <Group>
      <p className="py-5 text-[15px] leading-relaxed text-muted">{text}</p>
    </Group>
  );
  if (computers === undefined) return null;
  if (computers === null) return note(tr('Não deu para buscar os workspaces agora. Confira a internet.', "Couldn't fetch the workspaces right now. Check your connection."));
  const withBoards = computers.filter((c) => c.boards.length);
  if (!withBoards.length) {
    return (
      <EmptyState
        art={<WorkspacesArt />}
        title={tr('Seus workspaces em qualquer computador', 'Your workspaces on any computer')}
        text={tr(
          'Entre nesta mesma conta no Argus de outro computador. Os workspaces de lá aparecem aqui, e você traz só os que quiser.',
          'Sign in to this same account in Argus on another computer. Its workspaces show up here, and you bring over only the ones you want.',
        )}
      />
    );
  }
  return (
    <>
      {note(intro())}
      {withBoards.map((c) => (
        <Group key={c.id}>
          <div className="border-b border-dashed border-line pb-2 pt-5 text-[15px] text-muted">
            <span className="font-medium text-text">{c.name}</span>
            {` - ${platformName(c.platform)} - ${tr('atualizado', 'updated')} ${relativeTime(new Date(c.updatedAt).toISOString())}`}
          </div>
          {c.boards.map((b) => (
            <BoardRow key={b.id} computer={c} board={b} />
          ))}
        </Group>
      ))}
    </>
  );
}
