import type { UpdateState } from '@argus/shared/updates';
import { useNow } from '../lib/clock';

// A barra de título avisa quando a atualização não funciona há um dia ou mais: conferências falhando
// ou atualização desligada (o "desde quando" vem do processo principal, ver updater/trouble.ts).
// Antes disso, uma falha solta (Wi-Fi caiu) se resolve na próxima conferência, sem incomodar.
export const TROUBLE_AFTER_MS = 24 * 60 * 60_000;

// reason: o erro da última conferência, ou por que a atualização está desligada. canRetry: com erro,
// procurar de novo pode dar certo; desligada, não adianta.
export type UpdateTrouble = { reason: string; since: number; canRetry: boolean };

export function updateTrouble(state: UpdateState | undefined, now: number): UpdateTrouble | null {
  if (state?.status !== 'error' && state?.status !== 'unsupported') return null;
  if (!state.since || now - state.since < TROUBLE_AFTER_MS) return null;
  return state.status === 'error'
    ? { reason: state.message, since: state.since, canRetry: true }
    : { reason: state.reason, since: state.since, canRetry: false };
}

// De hora em hora basta: o aviso aparece no máximo uma hora depois de completar o dia.
export function useUpdateTrouble(state: UpdateState | undefined): UpdateTrouble | null {
  return updateTrouble(state, useNow(60 * 60_000));
}
