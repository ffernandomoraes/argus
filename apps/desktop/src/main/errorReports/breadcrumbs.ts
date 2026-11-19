import type { Breadcrumb } from '@sentry/electron/main';

// O rastro do Sentry (as últimas ações antes do erro) tem uma lista só para tudo. Uma ação que se
// repete sem parar ocupava as vagas e empurrava para fora o que explicaria o erro: ARGUS-K, 2026-11-18,
// 36 das 60 eram o player falhando a cada 2 s. Agora cada ação igual entra no máximo ALLOWED vezes em
// WINDOW_MS; as outras viram uma contagem, que volta ao rastro no relatório (repeatSummaries).

const WINDOW_MS = 10 * 60_000;
const ALLOWED = 3;
const FINISHED_KEPT = 20;
const MAX_RUNS = 500;

type Run = { sample: Breadcrumb; count: number; suppressed: number; firstAt: number; lastAt: number };

const runs = new Map<string, Run>();
const finished: Run[] = [];

const keyOf = (b: Breadcrumb) => `${b.category ?? ''}|${b.message ?? ''}|${JSON.stringify(b.data ?? {})}`;

function close(key: string, run: Run): void {
  runs.delete(key);
  if (!run.suppressed) return;
  finished.push(run);
  if (finished.length > FINISHED_KEPT) finished.shift();
}

function pruneRuns(now: number): void {
  if (runs.size < MAX_RUNS) return;
  for (const [key, run] of runs) if (now - run.firstAt > WINDOW_MS) close(key, run);
}

export function collapseRepeats(b: Breadcrumb, now = Date.now()): Breadcrumb | null {
  const key = keyOf(b);
  let run = runs.get(key);
  if (run && now - run.firstAt > WINDOW_MS) {
    close(key, run);
    run = undefined;
  }
  if (!run) {
    pruneRuns(now);
    run = { sample: b, count: 0, suppressed: 0, firstAt: now, lastAt: now };
    runs.set(key, run);
  }
  run.count++;
  run.lastAt = now;
  if (run.count <= ALLOWED) return b;
  run.suppressed++;
  return null;
}

const clock = (at: number) => new Date(at).toISOString().slice(11, 19);

// As contagens, como ações do rastro, na hora da última repetição.
export function repeatSummaries(): Breadcrumb[] {
  return [...finished, ...[...runs.values()].filter((r) => r.suppressed)].map((r) => ({
    timestamp: r.lastAt / 1000,
    category: 'repeated',
    level: 'info',
    message: `${r.sample.category ?? ''}: "${r.sample.message ?? ''}" repetiu mais ${r.suppressed}x de ${clock(r.firstAt)} a ${clock(r.lastAt)}`,
    data: r.sample.data,
  }));
}

// As mesmas contagens em texto, para o relatório de travamento do processo principal (que sai sem
// passar pelo beforeSend; ver journalReport.ts).
export const repeatSummaryText = (): string =>
  repeatSummaries()
    .map((b) => b.message)
    .join('\n');

// Nome das chamadas de rede: o Sentry esconde o endereço de algumas (aparecia "[Filtered]" na leitura
// de uso, ARGUS-K), e sem saber qual chamada falhou não dava para seguir o rastro.
const ENDPOINTS: [RegExp, string][] = [
  [/api\.anthropic\.com\/api\/oauth\/usage/, 'claude-usage'],
  [/api\.anthropic\.com/, 'anthropic'],
  [/telemetry\.argusterm\.com/, 'argus-telemetry'],
  [/api\.github\.com\/repos\/[^/]+\/argus\/releases/, 'argus-update-check'],
  [/github\.com\/[^/]+\/argus\/releases\/download/, 'argus-update-download'],
  [/registry\.npmjs\.org\/@anthropic-ai\/claude-code/, 'claude-code-version'],
];

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

export function labelHttp(b: Breadcrumb): Breadcrumb {
  const url = b.data?.url;
  if ((b.category !== 'http' && b.category !== 'electron.net') || typeof url !== 'string') return b;
  const endpoint = ENDPOINTS.find(([pattern]) => pattern.test(url))?.[1] ?? hostOf(url);
  return { ...b, data: { ...b.data, endpoint } };
}

// Para os testes.
export function clearRepeats(): void {
  runs.clear();
  finished.length = 0;
}
