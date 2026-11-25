import type { Request } from 'express';

// Limite de pedidos em memória, por chave (o IP), numa janela deslizante. Padrão do codes-modules.

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private lastSweep: number;

  constructor(
    private readonly windowMs: number,
    private readonly max: number,
    private readonly now: () => number = Date.now,
  ) {
    this.lastSweep = now();
  }

  tryHit(key: string): boolean {
    const now = this.now();
    this.sweep(now);
    const recent = (this.hits.get(key) ?? []).filter((time) => time > now - this.windowMs);
    const full = recent.length >= this.max;
    if (!full) recent.push(now);
    this.hits.set(key, recent);
    return !full;
  }

  // Quanto falta para `key` poder de novo (0: pode agora).
  retryAfterMs(key: string): number {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((time) => time > now - this.windowMs);
    if (recent.length < this.max) return 0;
    return (recent[0] ?? now) + this.windowMs - now;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [key, times] of this.hits) {
      if ((times.at(-1) ?? 0) <= now - this.windowMs) this.hits.delete(key);
    }
  }
}

// O IP de quem pediu. Atrás da Railway (behindProxy), o x-real-ip: a borda dela troca o que o
// cliente mandou pelo IP de onde a conexão veio. Fora dela (dev, testes), o cabeçalho vem de quem
// pede e não vale nada: conta o IP da conexão.
export function byIp(behindProxy: boolean): (req: Request) => string | null {
  return (req) => {
    const realIp = behindProxy ? req.get('x-real-ip')?.trim() : undefined;
    return realIp || req.ip || null;
  };
}
