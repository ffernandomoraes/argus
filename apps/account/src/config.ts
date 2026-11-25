import { z } from 'zod';

// Variáveis de ambiente, conferidas ao subir (padrão do codes-modules, api-core). Os valores de
// produção ficam no serviço da Railway (ver README.md).

export const DEFAULT_PUBLIC_URL = 'https://account.argusterm.com';
// O app do celular (servido pela ponte do acesso remoto): para onde o login do celular volta e a
// única origem de navegador que pode chamar a API (ver middlewares/cors.ts).
export const DEFAULT_WEB_APP_URL = 'https://remote.argusterm.com';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
    BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET é obrigatória'),
    // Endereço público do servidor: base dos endereços de volta cadastrados no GitHub e no Google.
    PUBLIC_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    WEB_APP_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    GITHUB_CLIENT_ID: optionalString,
    GITHUB_CLIENT_SECRET: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    // App do GitHub (não é o login): lê os repositórios que a pessoa liberou, para clonar pelo Argus
    // (ver modules/github). Sem os três, a conexão com o GitHub fica desligada.
    GITHUB_APP_CLIENT_ID: optionalString,
    GITHUB_APP_CLIENT_SECRET: optionalString,
    GITHUB_APP_SLUG: optionalString,
    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
    // Começos de login e de conexão do GitHub por IP a cada 10 minutos (ver app.ts).
    STARTS_PER_10_MINUTES: z.coerce.number().int().positive().default(30),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.BETTER_AUTH_SECRET.length < 32) {
      ctx.addIssue({ code: 'custom', path: ['BETTER_AUTH_SECRET'], message: 'Em produção, precisa de pelo menos 32 caracteres (openssl rand -base64 32)' });
    }
    if (env.DATABASE_URL.startsWith('pglite:')) {
      ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Em produção, use o Postgres: o PGlite é só para desenvolvimento e testes' });
    }
    for (const name of ['GITHUB', 'GOOGLE'] as const) {
      if (!env[`${name}_CLIENT_ID`] || !env[`${name}_CLIENT_SECRET`]) {
        ctx.addIssue({ code: 'custom', path: [`${name}_CLIENT_SECRET`], message: `Em produção, o login com ${name} precisa do ID e do segredo` });
      }
    }
  })
  .transform((env) => ({
    ...env,
    PUBLIC_URL: (env.PUBLIC_URL ?? DEFAULT_PUBLIC_URL).replace(/\/+$/, ''),
    WEB_APP_URL: (env.WEB_APP_URL ?? DEFAULT_WEB_APP_URL).replace(/\/+$/, ''),
  }));

export type Config = z.output<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${lines.join('\n')}`);
  }
  return result.data;
}

export type Provider = 'github' | 'google';
export const PROVIDERS: readonly Provider[] = ['github', 'google'];

export const isProvider = (value: unknown): value is Provider => value === 'github' || value === 'google';

// Provedor com ID e segredo configurados (no dev, pode faltar um deles).
export function providerEnabled(config: Config, provider: Provider): boolean {
  return provider === 'github'
    ? Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET)
    : Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
}

// App do GitHub configurado (ID, segredo e o nome dele no endereço de instalação).
export function githubAppEnabled(config: Config): boolean {
  return Boolean(config.GITHUB_APP_CLIENT_ID && config.GITHUB_APP_CLIENT_SECRET && config.GITHUB_APP_SLUG);
}
