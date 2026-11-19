import { note } from './journal';

// Quanto as operações que já travaram o processo principal costumam levar. O relatório de travamento
// diz onde o processo parou (uma consulta ao disco, um programa sendo aberto), mas não se aquilo é
// sempre lento naquela máquina ou se foi só daquela vez (o sistema parado, o disco acordando). Com a
// mediana e o máximo de cada uma, dá para dizer. Entram aqui as operações que aparecem nos
// travamentos: cada investigação de um travamento novo acrescenta a operação dele (ARGUS-M, N e G,
// 2026-11-19, foram as primeiras).

const SLOW_MS = 200;
const RECENT = 50;

type Stat = { count: number; slow: number; maxMs: number; lastMs: number; recent: number[] };

const stats = new Map<string, Stat>();

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function recordDuration(label: string, ms: number): void {
  const s = stats.get(label) ?? { count: 0, slow: 0, maxMs: 0, lastMs: 0, recent: [] };
  const rounded = Math.round(ms);
  s.count++;
  s.lastMs = rounded;
  s.maxMs = Math.max(s.maxMs, rounded);
  s.recent.push(rounded);
  if (s.recent.length > RECENT) s.recent.shift();
  stats.set(label, s);
  if (ms < SLOW_MS) return;
  s.slow++;
  note('slow', `${label} levou ${rounded} ms`, { medianMs: median(s.recent), times: s.count });
}

// Mede uma operação síncrona (a que segura o processo principal enquanto roda).
export function timed<T>(label: string, run: () => T): T {
  const start = performance.now();
  try {
    return run();
  } finally {
    recordDuration(label, performance.now() - start);
  }
}

export function operationStats(): Record<string, { count: number; medianMs: number; maxMs: number; lastMs: number; slow: number }> {
  const out: ReturnType<typeof operationStats> = {};
  for (const [label, s] of stats) out[label] = { count: s.count, medianMs: median(s.recent), maxMs: s.maxMs, lastMs: s.lastMs, slow: s.slow };
  return out;
}

// Para os testes.
export function clearTimings(): void {
  stats.clear();
}
