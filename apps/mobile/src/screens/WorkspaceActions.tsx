import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { tr } from '../i18n';
import type { Workspace } from '../lib/data';
import { useHost } from '../lib/host';
import { ConfirmSheet } from '../ui/ConfirmSheet';
import { Sheet } from '../ui/Sheet';
import { TextSheet } from '../ui/TextSheet';

// Tocar e segurar a etiqueta de um workspace (aba Projetos): Renomear ou Excluir, como no seletor de
// workspaces do Argus. Excluir pede confirmação; o canvas vai para a Lixeira do computador.

type Step = 'menu' | 'rename' | 'remove' | null;

export function WorkspaceActions({ workspace, onClose, onError }: { workspace: Workspace | null; onClose: () => void; onError: (message: string) => void }) {
  const { conn } = useHost();
  const [step, setStep] = useState<Step>('menu');
  // O workspace fica guardado enquanto as gavetas fecham (a animação ainda mostra o nome).
  const [target, setTarget] = useState(workspace);
  // Cada toque longo (o workspace passa de nulo para um) começa pelo menu.
  const [prev, setPrev] = useState(workspace);
  if (workspace !== prev) {
    setPrev(workspace);
    if (workspace) {
      setTarget(workspace);
      setStep('menu');
    }
  }
  const close = () => {
    setStep(null);
    onClose();
  };
  const fail = (err: unknown) => onError(err instanceof Error ? err.message : String(err));

  const rename = (name: string) => {
    if (target) conn.call('boards:rename', target.id, name).catch(fail);
  };
  // No Argus, só sai de vez o workspace fechado: fecha e exclui em seguida.
  const remove = () => {
    if (!target) return;
    conn
      .call('boards:close', target.id)
      .then(() => conn.call('boards:remove', target.id))
      .catch(fail);
  };

  const open = !!workspace;
  const item = 'flex w-full items-center gap-3 border-b border-line px-4 py-[13px] text-left text-[15px] last:border-0 active:bg-card-press';
  return (
    <>
      <Sheet open={open && step === 'menu'} onClose={close} title={target?.name}>
        <div className="overflow-hidden rounded-[12px] border border-card-border bg-card">
          <button type="button" className={item} onClick={() => setStep('rename')}>
            <Pencil size={20} className="text-muted" />
            {tr('Renomear', 'Rename')}
          </button>
          <button type="button" className={`${item} text-red`} onClick={() => setStep('remove')}>
            <Trash2 size={20} />
            {tr('Excluir', 'Delete')}
          </button>
        </div>
      </Sheet>
      <TextSheet
        open={open && step === 'rename'}
        title={tr('Renomear workspace', 'Rename workspace')}
        placeholder={tr('Nome do workspace', 'Workspace name')}
        initial={target?.name ?? ''}
        confirmLabel={tr('Salvar', 'Save')}
        onConfirm={rename}
        onClose={close}
      />
      <ConfirmSheet
        open={open && step === 'remove'}
        title={tr(`Excluir o workspace "${target?.name ?? ''}"?`, `Delete the workspace "${target?.name ?? ''}"?`)}
        message={tr(
          'O canvas dele vai para a Lixeira do computador e os terminais abertos nele são fechados. As pastas e as conversas continuam no computador.',
          'Its canvas goes to the computer’s Trash and the terminals open in it are closed. The folders and chats stay on the computer.',
        )}
        confirmLabel={tr('Excluir workspace', 'Delete workspace')}
        danger
        onConfirm={remove}
        onClose={close}
      />
    </>
  );
}
