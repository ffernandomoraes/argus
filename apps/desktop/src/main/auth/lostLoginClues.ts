import { net } from 'electron';
import { claudeCensus } from '../diagnostics/claudeCensus';
import { argusClaudes, lastClaudeFailure } from '../diagnostics/claudeProcesses';
import { recentLoginChanges } from '../diagnostics/loginHistory';
import { msSinceResume } from '../diagnostics/system';
import { withTimeout } from '../lib/timeout';

// As hipóteses do login perdido, respondidas no próprio aviso (ARGUS-K, 2026-11-18, não tinha como
// confirmar nem descartar nenhuma):
// - outro programa renovou o mesmo login (loginChanges com argus=0; otherClaudes e de quem são);
// - o `claude` que o Argus abriu falhou ao renovar (claudeFailure: qual, como saiu e o que escreveu);
// - o computador tinha acabado de acordar, ou estava sem rede (minutesSinceResume, online).

const CENSUS_TIMEOUT_MS = 5000;
const FAILURE_WINDOW_MS = 30 * 60_000;

export async function lostLoginClues(account: string, now = Date.now()): Promise<Record<string, unknown>> {
  const census = await withTimeout(claudeCensus().catch(() => null), CENSUS_TIMEOUT_MS, null);
  const failure = lastClaudeFailure(account, FAILURE_WINDOW_MS, now);
  const resumed = msSinceResume(now);
  return {
    loginChanges: recentLoginChanges(account, now) || null,
    argusClaudesOpen: argusClaudes(account),
    otherClaudes: census ? census.outsideArgus : null,
    otherClaudesOpenedBy: census?.parents.join(', ') || null,
    claudeFailure: failure && {
      role: failure.role,
      exit: failure.exit,
      secondsAgo: Math.round((now - failure.at) / 1000),
      openMinutes: Math.round(failure.ms / 60_000),
      stderr: failure.stderr || null,
    },
    minutesSinceResume: resumed === null ? null : Math.round(resumed / 60_000),
    online: net.isOnline(),
  };
}
