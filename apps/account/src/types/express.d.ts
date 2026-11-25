import type { AuthSession, AuthUser } from '../modules/auth/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      session?: AuthSession
    }
  }
}

export {};
