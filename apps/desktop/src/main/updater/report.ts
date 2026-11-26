import { app } from 'electron';
import type { UpdateState } from '@argus/shared/updates';
import { note } from '../diagnostics/journal';
import { reportWarning } from '../errorReports';
import { errorMessage } from '../lib/errors';
import { skippedVersion } from './skipped';

// Rastro das conferências de atualização. Sem ele, quem ficava dias preso numa versão não deixava
// pista: o erro só aparecia em Configurações (caso de 2026-11-26, Windows parado na 0.1.152 por seis
// versões). Cada conferência vira uma linha no diário; falhas seguidas viram um aviso no Sentry,
// com o diário anexado.

// Falhas seguidas, sem nenhuma conferência certa no meio, para avisar. Uma falha solta (Wi-Fi caiu)
// não diz nada; três seguidas, com 5 horas entre as automáticas, já é a máquina presa.
export const FAILURES_TO_REPORT = 3;
// As últimas mensagens de erro que vão no aviso.
const KEPT_ERRORS = 3;

export type CheckResult = {
  // Pedida por alguém (botão, menu) ou automática.
  visible: boolean
  // Versão do release mais recente do GitHub; vazia se nem chegou a ler.
  found: string
  state: UpdateState
  failure: unknown
};

type Tracker = { failures: number; errors: string[]; reported: boolean };

// Decide, sem efeito colateral, o que fazer com o resultado: devolve true quando é a hora de avisar.
// Avisa uma vez por sessão do app; uma conferência certa zera a contagem.
export function trackFailure(t: Tracker, error: string | null, limit = FAILURES_TO_REPORT): boolean {
  if (error === null) {
    t.failures = 0;
    t.errors = [];
    return false;
  }
  t.failures++;
  t.errors = [...t.errors, error].slice(-KEPT_ERRORS);
  if (t.reported || t.failures < limit) return false;
  t.reported = true;
  return true;
}

const tracker: Tracker = { failures: 0, errors: [], reported: false };

export function recordCheck({ visible, found, state, failure }: CheckResult): void {
  const error = failure ? errorMessage(failure) : null;
  const latest = found || null;
  const current = app.getVersion();
  const skipped = skippedVersion();
  note('update', error ? 'conferência falhou' : 'conferência feita', {
    visible,
    current,
    found: latest,
    skipped,
    result: state.status,
    readyVersion: state.status === 'ready' || state.status === 'waiting' ? state.version : undefined,
    error,
  });
  if (!trackFailure(tracker, error)) return;
  reportWarning('Atualização falhando', { current, found: latest, skipped, failures: tracker.failures, errors: tracker.errors });
}

// Onde o app não se atualiza (rodando de fora do instalador, do .dmg): fica anotado o motivo.
export function recordUnsupported(reason: string): void {
  note('update', 'atualização desligada', { current: app.getVersion(), reason });
}
