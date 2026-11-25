import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';

import { providerEnabled, type Config, type Provider } from '../../config';
import type { Database } from '../../db/client';
import { authTables } from './auth.table';

// Login com GitHub e Google pelo Better Auth (o módulo auth do codes-modules, só com os provedores
// sociais). O app do computador não usa cookie: recebe o token da sessão (ver modules/desktop) e
// manda como "Authorization: Bearer" (plugin bearer).
//
// - Mesmo e-mail confirmado pelo provedor no GitHub e no Google: a mesma pessoa (accountLinking). O
//   Better Auth só liga quando o provedor diz que o e-mail é confirmado.
// - Os endereços de volta são os cadastrados no GitHub e no Google (PUBLIC_URL/auth/<provedor>/callback);
//   desktop.browser.ts repassa para a rota do Better Auth.
// - Os acessos do GitHub e do Google não ficam guardados: servem só para ler nome, e-mail e foto.

export const SESSION_DAYS = 180;

export const providerCallbackUrl = (config: Config, provider: Provider) => `${config.PUBLIC_URL}/auth/${provider}/callback`;

// O que o Better Auth guardaria do acesso ao provedor. Fica vazio.
const withoutTokens = <T extends object>(data: T) => ({
  ...data,
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
});

function socialProviders(config: Config) {
  return {
    ...(providerEnabled(config, 'github') && {
      github: {
        clientId: config.GITHUB_CLIENT_ID ?? '',
        clientSecret: config.GITHUB_CLIENT_SECRET ?? '',
        redirectURI: providerCallbackUrl(config, 'github'),
      },
    }),
    ...(providerEnabled(config, 'google') && {
      google: {
        clientId: config.GOOGLE_CLIENT_ID ?? '',
        clientSecret: config.GOOGLE_CLIENT_SECRET ?? '',
        redirectURI: providerCallbackUrl(config, 'google'),
        // Deixa escolher a conta do Google a cada login (quem tem a pessoal e a do trabalho).
        prompt: 'select_account' as const,
      },
    }),
  };
}

export function createAuth(deps: { db: Database; config: Config }) {
  const { db, config } = deps;
  return betterAuth({
    appName: 'Argus',
    baseURL: config.PUBLIC_URL,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema: authTables }),
    trustedOrigins: [config.PUBLIC_URL],
    socialProviders: socialProviders(config),
    // A sessão do computador dura enquanto ele for usado: cada dia de uso empurra o fim para frente.
    session: { expiresIn: SESSION_DAYS * 86_400, updateAge: 86_400 },
    account: { accountLinking: { enabled: true } },
    databaseHooks: {
      account: {
        create: { before: (data) => Promise.resolve({ data: withoutTokens(data) }) },
        update: { before: (data) => Promise.resolve({ data: withoutTokens(data) }) },
      },
    },
    plugins: [bearer()],
    // Volta do provedor sem o estado do login (link velho, aberto à mão): a página de erro daqui, já
    // que as rotas do Better Auth fora a da volta não ficam abertas (ver app.ts).
    onAPIError: { errorURL: `${config.PUBLIC_URL}/auth/done` },
    advanced: {
      useSecureCookies: config.PUBLIC_URL.startsWith('https://'),
      // O da borda da Railway (ver lib/rateLimiter.ts); o x-forwarded-for pode vir com o que o cliente mandou.
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
export type AuthUser = AuthSessionData['user'];
export type AuthSession = AuthSessionData['session'];
