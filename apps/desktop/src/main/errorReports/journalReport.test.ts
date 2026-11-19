import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Sentry from '@sentry/electron/main';
import { clearJournal, note } from '../diagnostics/journal';
import { clearTimings, recordDuration } from '../diagnostics/timing';
import { clearRepeats, collapseRepeats } from './breadcrumbs';
import { withJournal } from './journalReport';

// Cada relatório leva o diário anexado, o estado do sistema e o tempo das operações medidas, e as
// contagens das ações repetidas voltam ao rastro.

vi.mock('@sentry/electron/main', () => ({ getGlobalScope: () => ({}) }));

afterEach(() => {
  clearJournal();
  clearTimings();
  clearRepeats();
});

describe('diário no relatório', () => {
  it('anexa o diário, tira a cópia do escopo e junta as contagens ao rastro', () => {
    note('login', 'conta perdeu o login', { account: 'main' });
    recordDuration('netstatSpawn', 12);
    for (let i = 0; i < 5; i++) collapseRepeats({ category: 'child_process', message: 'exit 1' }, Date.now());
    const event = {
      extra: { journal: 'fim do diário', repeated: 'x', other: 1 },
      breadcrumbs: [{ timestamp: 1, category: 'ui', message: 'clique' }],
    } as unknown as Sentry.ErrorEvent;
    const hint: Sentry.EventHint = {};

    const out = withJournal(event, hint);

    expect(hint.attachments).toHaveLength(1);
    expect(hint.attachments?.[0]).toMatchObject({ filename: 'journal.txt', contentType: 'text/plain' });
    expect(String(hint.attachments?.[0].data)).toContain('[login] conta perdeu o login account=main');
    expect(out.extra).toEqual({ other: 1 });
    expect(out.breadcrumbs?.map((b) => b.category)).toEqual(['ui', 'repeated']);
    expect(out.contexts?.operations).toEqual({ netstatSpawn: { count: 1, medianMs: 12, maxMs: 12, lastMs: 12, slow: 0 } });
    expect(out.contexts?.['system state']).toHaveProperty('appStartedAt');
  });

  it('sem nada no diário, sem anexo', () => {
    const hint: Sentry.EventHint = {};
    withJournal({} as Sentry.ErrorEvent, hint);
    expect(hint.attachments).toBeUndefined();
  });
});
