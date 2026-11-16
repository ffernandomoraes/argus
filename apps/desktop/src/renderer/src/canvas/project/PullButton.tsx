import { useState } from 'react';
import { ArrowDownToLine, Check, Loader2 } from 'lucide-react';
import { tr } from '../../i18n';

// Atalho no topo do seletor de branch: git pull da branch atual (só avançando, sem merge).
// Avisa por `onResult` o erro ou a mensagem de sucesso, mostrados embaixo da busca.
export function PullButton({
  path,
  branch,
  onResult,
}: {
  path: string
  branch: string
  onResult: (error: string | null, notice: string | null) => void
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  const pull = async () => {
    if (state === 'busy') return;
    setState('busy');
    onResult(null, null);
    const { error, updated } = await window.api.sessions.pull(path);
    if (error) {
      setState('idle');
      onResult(error, null);
      return;
    }
    setState('done');
    onResult(null, updated ? tr(`${branch} atualizada.`, `${branch} updated.`) : tr(`${branch} já estava em dia.`, `${branch} was already up to date.`));
    setTimeout(() => setState('idle'), 2000);
  };

  const label = tr(`Git pull em ${branch}`, `Git pull on ${branch}`);
  return (
    <button
      onClick={pull}
      disabled={state === 'busy'}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-fill text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
    >
      {state === 'busy' ? (
        <Loader2 size={13} className="animate-spin" />
      ) : state === 'done' ? (
        <Check size={13} />
      ) : (
        <ArrowDownToLine size={13} />
      )}
    </button>
  );
}
