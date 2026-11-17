import type { ReactNode } from 'react';

// Trechos marcados, [início, fim), em ordem e sem sobreposição.
export type Ranges = readonly (readonly [number, number])[];

// Posições soltas (as letras achadas na busca pelo nome) viram trechos: letras seguidas, um só.
export function positionsToRanges(positions: readonly number[], from = 0, to = Infinity): [number, number][] {
  const ranges: [number, number][] = [];
  for (const p of positions) {
    if (p < from || p >= to) continue;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === p - from) last[1]++;
    else ranges.push([p - from, p - from + 1]);
  }
  return ranges;
}

// Texto com os trechos achados marcados, como o destaque da busca de conversas.
export function Marked({ text, ranges, className = 'rounded-sm bg-amber-400/35 text-text' }: { text: string; ranges: Ranges; className?: string }) {
  if (!ranges.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const [a, b] of ranges) {
    if (a < last) continue;
    if (a > last) parts.push(text.slice(last, a));
    parts.push(
      <mark key={a} className={className}>
        {text.slice(a, b)}
      </mark>,
    );
    last = b;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
