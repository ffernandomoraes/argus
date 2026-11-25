import type { Request, RequestHandler } from 'express';

import { tooManyRequests } from '../errors';
import type { RateLimiter } from '../lib/rateLimiter';

export function rateLimit(limiter: RateLimiter, keyOf: (req: Request) => string | null): RequestHandler {
  return (req, res, next) => {
    const key = keyOf(req);
    if (key !== null && !limiter.tryHit(key)) {
      res.setHeader('Retry-After', '60');
      throw tooManyRequests();
    }
    next();
  };
}
