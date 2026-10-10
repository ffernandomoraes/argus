import type { UpdateState } from '../../../../shared/updates'

export type UpdateProgress = {
  // Versão baixada e pronta para entrar ao reiniciar.
  ready: string | null
  // Sutil, ao lado da versão: só enquanto procura ou baixa, para saber que a conferência rodou.
  progress: string | null
}

export function updateProgress(state: UpdateState | undefined): UpdateProgress {
  return {
    ready: state?.status === 'ready' ? state.version : null,
    progress:
      state?.status === 'checking'
        ? 'Procurando atualização…'
        : state?.status === 'downloading'
          ? `Baixando ${state.version} - ${Math.round(state.progress * 100)}%`
          : null
  }
}
