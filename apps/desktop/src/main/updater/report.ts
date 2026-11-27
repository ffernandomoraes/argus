import { app } from 'electron';
import type { UpdateState } from '@argus/shared/updates';
import { note, type JournalData } from '../diagnostics/journal';
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

// Onde o app não se atualiza (rodando de fora do instalador, do .dmg): fica anotado o motivo e, no
// app instalado, vai um aviso ao Sentry a cada abertura. Antes era só o diário, e a atualização
// desligada não deixava pista: o app parava numa versão sem nenhuma consulta ao GitHub (caso de
// 2026-11-27, Windows parado na 0.1.152). clues: o que separa as causas (no Windows, installClues).
export function recordUnsupported(reason: string, clues: JournalData = {}): void {
  const current = app.getVersion();
  note('update', 'atualização desligada', { current, reason, ...clues });
  if (app.isPackaged) reportWarning('Atualização desligada', { current, reason, ...clues });
}

// Windows na pasta do instalador sem o desinstalador: a atualização segue (ver installedByInstaller),
// mas o aviso mostra se é antivírus apagando o arquivo, a suspeita do caso de 2026-11-27.
export function recordMissingUninstaller(clues: JournalData): void {
  const current = app.getVersion();
  note('update', 'desinstalador ausente', { current, ...clues });
  if (app.isPackaged) reportWarning('Atualização sem o desinstalador', { current, ...clues });
}
