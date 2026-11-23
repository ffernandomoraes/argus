import * as Sentry from '@sentry/electron/main';
import { journalTail, journalText, journalVersion } from '../diagnostics/journal';
import { systemState } from '../diagnostics/system';
import { operationStats } from '../diagnostics/timing';
import { repeatSummaries, repeatSummaryText } from './breadcrumbs';

// O diário (diagnostics/journal.ts) nos relatórios de erro.
//
// Os relatórios comuns passam pelo beforeSend: levam o diário das últimas horas como anexo
// (journal.txt), o estado do sistema e o tempo das operações medidas, e as contagens das ações
// repetidas do rastro. O de travamento do processo principal sai por uma linha de execução à parte,
// sem beforeSend nem anexo: leva só o que estiver no escopo global do Sentry, que essa linha copia a
// cada poucos segundos. Por isso o fim do diário e o resto ficam também no escopo (syncJournalToScope).
// O texto do diário já sai limpo (ver journal.ts): o relatório de travamento não passa pela limpeza.
// Só chega com o @sentry/node-native na versão que o @sentry/electron pede: com outra, a linha lê o
// escopo de outra cópia do SDK, vazio (ver sentryCopies.test.ts). O rastro de ações não vai: ele fica
// no escopo de isolamento, que a linha não copia.

const ATTACH_WINDOW_MS = 3 * 60 * 60_000;
const ATTACH_MAX_CHARS = 200_000;
const TAIL_LINES = 80;
const TAIL_MAX_CHARS = 10_000;
const SCOPE_SYNC_MS = 5000;

export function withJournal(event: Sentry.ErrorEvent, hint: Sentry.EventHint): Sentry.ErrorEvent {
  const text = journalText(ATTACH_WINDOW_MS, ATTACH_MAX_CHARS);
  if (text) hint.attachments = [...(hint.attachments ?? []), { filename: 'journal.txt', data: text, contentType: 'text/plain' }];
  // O fim do diário que o escopo leva já está no anexo, inteiro.
  if (event.extra) {
    delete event.extra.journal;
    delete event.extra.repeated;
  }
  const repeats = repeatSummaries();
  if (repeats.length) {
    event.breadcrumbs = [...(event.breadcrumbs ?? []), ...repeats].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  }
  event.contexts = { ...event.contexts, 'system state': systemState(), operations: operationStats() };
  return event;
}

export function syncJournalToScope(): void {
  let synced = -1;
  setInterval(() => {
    const scope = Sentry.getGlobalScope();
    scope.setContext('system state', systemState());
    scope.setContext('operations', operationStats());
    scope.setExtra('repeated', repeatSummaryText() || undefined);
    const version = journalVersion();
    if (version === synced) return;
    synced = version;
    scope.setExtra('journal', journalTail(TAIL_LINES, TAIL_MAX_CHARS));
  }, SCOPE_SYNC_MS).unref();
}
