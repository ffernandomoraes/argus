import { createHmac, randomUUID } from 'node:crypto';

import request from 'supertest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDatabase } from '../src/db/client';
import * as schema from '../src/db/schema';
import { createAuth } from '../src/modules/auth/auth';

// Servidor de teste com o banco em memória (PGlite) e provedores de mentira configurados.

export const PUBLIC_URL = 'http://localhost:3000';
const SECRET = 'test-secret-that-is-long-enough-for-better-auth';

// O cookie que a volta do provedor deixa no navegador (assinado como o Better Auth assina).
export function browserCookie(token: string): string {
  const signature = createHmac('sha256', SECRET).update(token).digest('base64');
  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

export async function createTestContext() {
  const database = await createDatabase('pglite:memory');
  await database.migrate();
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite:memory',
    BETTER_AUTH_SECRET: SECRET,
    PUBLIC_URL,
    GITHUB_CLIENT_ID: 'github-id',
    GITHUB_CLIENT_SECRET: 'github-secret',
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GITHUB_APP_CLIENT_ID: 'gh-app-id',
    GITHUB_APP_CLIENT_SECRET: 'gh-app-secret',
    GITHUB_APP_SLUG: 'argus-test',
    RATE_LIMIT_PER_MINUTE: '100000',
    STARTS_PER_10_MINUTES: '100000',
  });
  const auth = createAuth({ db: database.db, config });
  const app = createApp({ config, db: database.db, auth });

  async function createUser(email: string, name = 'Pessoa Teste') {
    const [user] = await database.db.insert(schema.user).values({ id: randomUUID(), email, name, emailVerified: true }).returning();
    if (!user) throw new Error('createUser failed');
    return user;
  }

  // Sessão sem aparelho: a do navegador no meio do login.
  async function createSession(userId: string) {
    const context = await auth.$context;
    return context.internalAdapter.createSession(userId);
  }

  // Pessoa com um computador na conta.
  async function signedIn(email: string, device = 'Mac do teste') {
    const user = await createUser(email);
    const session = await createSession(user.id);
    await database.db.insert(schema.desktopDevice).values({ sessionId: session.id, name: device, platform: 'darwin' });
    return { user, token: session.token, sessionId: session.id };
  }

  // Outro computador da mesma pessoa.
  async function otherDevice(userId: string, device = 'PC do teste', platform = 'win32') {
    const session = await createSession(userId);
    await database.db.insert(schema.desktopDevice).values({ sessionId: session.id, name: device, platform });
    return { token: session.token, sessionId: session.id };
  }

  function as(token: string | null) {
    const agent = request(app);
    const withAuth = <T extends request.Test>(test: T): T => (token ? test.set('Authorization', `Bearer ${token}`) : test);
    return {
      get: (path: string) => withAuth(agent.get(path)),
      post: (path: string, body?: object) => withAuth(agent.post(path)).send(body),
      put: (path: string, body?: object) => withAuth(agent.put(path)).send(body),
      delete: (path: string) => withAuth(agent.delete(path)),
    };
  }

  return { app, auth, config, db: database.db, createUser, createSession, signedIn, otherDevice, as, close: () => database.close() };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
