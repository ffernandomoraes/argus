import { barColor } from './usageFormat';

// Barrinha de uso: a cor muda com o quanto já foi usado (ver barColor).
export function UsageBar({ percent, className }: { percent: number; className: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full ${barColor(percent)}`} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}
