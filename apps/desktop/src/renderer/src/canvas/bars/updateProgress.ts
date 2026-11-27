import type { UpdateState } from '@argus/shared/updates';
import { tr } from '../../i18n';
import type { UpdateTrouble } from '../../updates/trouble';

export type UpdateProgress = {
  // Versão baixada e pronta para entrar ao reiniciar.
  ready: string | null
  // Sutil, ao lado da versão: só enquanto procura ou baixa, para saber que a conferência rodou.
  progress: string | null
};

// Algo da atualização ao lado da versão (o botão, o andamento ou o aviso de que não deu para
// atualizar): a barra abre mais espaço à direita para o título não encostar.
export const hasUpdateNotice = (p: UpdateProgress, trouble: UpdateTrouble | null): boolean => !!(p.ready || p.progress || trouble);

export function updateProgress(state: UpdateState | undefined): UpdateProgress {
  return {
    ready: state?.status === 'ready' ? state.version : null,
    progress:
      state?.status === 'checking'
        ? tr('Procurando atualização…', 'Checking for updates…')
        : state?.status === 'downloading'
          ? tr(`Baixando ${state.version} - ${Math.round(state.progress * 100)}%`, `Downloading ${state.version} - ${Math.round(state.progress * 100)}%`)
          : null,
  };
}
