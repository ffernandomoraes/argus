import { barColor } from './usageFormat';

// Barrinha do uso, com as cores do Argus (ver barColor).
export function UsageBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-code ${className}`}>
      <span className={`block h-full rounded-full ${barColor(percent)}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}
