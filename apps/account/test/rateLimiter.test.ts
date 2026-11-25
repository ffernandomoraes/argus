import { describe, expect, it } from 'vitest';

import { byIp, RateLimiter } from '../src/lib/rateLimiter';

// Limite de pedidos por chave numa janela deslizante, e de onde vem o IP.

describe('RateLimiter', () => {
  it('conta por chave, recusa no teto e diz quanto falta', () => {
    let now = 0;
    const limiter = new RateLimiter(1000, 2, () => now);
    expect(limiter.tryHit('a')).toBe(true);
    now = 400;
    expect(limiter.tryHit('a')).toBe(true);
    expect(limiter.tryHit('a')).toBe(false);
    expect(limiter.tryHit('b')).toBe(true);
    expect(limiter.retryAfterMs('a')).toBe(600);
    now = 1001;
    expect(limiter.retryAfterMs('a')).toBe(0);
    expect(limiter.tryHit('a')).toBe(true);
  });
});

describe('byIp', () => {
  const req = (realIp: string | undefined, ip: string) => ({ get: (name: string) => (name === 'x-real-ip' ? realIp : undefined), ip }) as never;

  it('só confia no x-real-ip atrás do proxy da Railway', () => {
    expect(byIp(true)(req('203.0.113.9', '10.0.0.1'))).toBe('203.0.113.9');
    expect(byIp(false)(req('203.0.113.9', '127.0.0.1'))).toBe('127.0.0.1');
    expect(byIp(true)(req(undefined, '10.0.0.1'))).toBe('10.0.0.1');
  });
});
