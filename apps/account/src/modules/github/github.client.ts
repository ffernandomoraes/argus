import type { Config } from '../../config';

// Os pedidos ao GitHub do app "Argus" (um App do GitHub, não o login): trocar o código da autorização
// pelas chaves, renovar, ler quem é e listar os repositórios liberados, e desfazer a autorização.
// `githubHttp.fetch` é trocado nos testes.

export const githubHttp = { fetch: (input: string, init?: RequestInit): Promise<Response> => fetch(input, init) };

const WEB = 'https://github.com';
const API = 'https://api.github.com';
// Teto da lista: quem tem mais que isso acha pelo nome no GitHub.
const MAX_REPOS = 2000;
const PAGE = 100;

export type GitHubTokens = {
  accessToken: string
  accessExpiresAt: Date | null
  refreshToken: string | null
  refreshExpiresAt: Date | null
};

export type GitHubRepo = {
  fullName: string
  name: string
  owner: string
  private: boolean
  description: string | null
  pushedAt: number | null
  cloneUrl: string
};

// O GitHub não aceita mais a chave (autorização desfeita, app desinstalado, renovação vencida): a
// conexão acabou e a pessoa conecta de novo.
export class GitHubAuthError extends Error {}

type Credentials = { clientId: string; clientSecret: string };

function credentials(config: Config): Credentials {
  if (!config.GITHUB_APP_CLIENT_ID || !config.GITHUB_APP_CLIENT_SECRET) throw new Error('App do GitHub não configurado');
  return { clientId: config.GITHUB_APP_CLIENT_ID, clientSecret: config.GITHUB_APP_CLIENT_SECRET };
}

export const githubCallbackUrl = (config: Config): string => `${config.PUBLIC_URL}/github/callback`;
export const githubInstallUrl = (config: Config): string => `${WEB}/apps/${encodeURIComponent(config.GITHUB_APP_SLUG ?? '')}/installations/new`;

export function githubAuthorizeUrl(config: Config, state: string): string {
  const query = new URLSearchParams({ client_id: credentials(config).clientId, redirect_uri: githubCallbackUrl(config), state });
  return `${WEB}/login/oauth/authorize?${query}`;
}

const after = (seconds: unknown, now: number): Date | null => (typeof seconds === 'number' && seconds > 0 ? new Date(now + seconds * 1000) : null);

async function tokenRequest(config: Config, params: Record<string, string>): Promise<GitHubTokens> {
  const { clientId, clientSecret } = credentials(config);
  const res = await githubHttp.fetch(`${WEB}/login/oauth/access_token`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub access_token: ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  // Código ou renovação vencidos, usados ou desfeitos.
  if (typeof body.error === 'string' || typeof body.access_token !== 'string') throw new GitHubAuthError(String(body.error ?? 'sem chave'));
  const now = Date.now();
  return {
    accessToken: body.access_token,
    accessExpiresAt: after(body.expires_in, now),
    refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
    refreshExpiresAt: after(body.refresh_token_expires_in, now),
  };
}

export const exchangeCode = (config: Config, code: string) => tokenRequest(config, { code, redirect_uri: githubCallbackUrl(config) });
export const refreshTokens = (config: Config, refreshToken: string) => tokenRequest(config, { grant_type: 'refresh_token', refresh_token: refreshToken });

async function api<T>(token: string, path: string): Promise<T> {
  const res = await githubHttp.fetch(`${API}${path}`, {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'Argus' },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new GitHubAuthError('chave recusada');
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchUser(token: string): Promise<{ id: string; login: string }> {
  const u = await api<{ id?: unknown; login?: unknown }>(token, '/user');
  if (typeof u.login !== 'string' || (typeof u.id !== 'number' && typeof u.id !== 'string')) throw new Error('GitHub /user sem login');
  return { id: String(u.id), login: u.login };
}

type RawRepo = { full_name?: unknown; name?: unknown; owner?: { login?: unknown }; private?: unknown; description?: unknown; pushed_at?: unknown; clone_url?: unknown };

function readRepo(r: RawRepo): GitHubRepo | null {
  if (typeof r.full_name !== 'string' || typeof r.name !== 'string' || typeof r.clone_url !== 'string' || !r.clone_url.startsWith('https://')) return null;
  const pushed = typeof r.pushed_at === 'string' ? Date.parse(r.pushed_at) : NaN;
  return {
    fullName: r.full_name,
    name: r.name,
    owner: typeof r.owner?.login === 'string' ? r.owner.login : r.full_name.split('/')[0]!,
    private: r.private === true,
    description: typeof r.description === 'string' ? r.description.slice(0, 200) : null,
    pushedAt: Number.isFinite(pushed) ? pushed : null,
    cloneUrl: r.clone_url,
  };
}

export type GitHubInstallation = {
  id: number
  // A conta ou a organização onde o app está instalado.
  account: string
  organization: boolean
  // all: todos os repositórios dela; selected: só os escolhidos.
  selection: 'all' | 'selected'
  // A página da instalação no GitHub (escolher repositórios, desinstalar).
  manageUrl: string
};

type RawInstallation = { id?: unknown; account?: { login?: unknown; type?: unknown }; repository_selection?: unknown; html_url?: unknown };

// As contas e organizações com o app instalado que a pessoa enxerga.
export async function listInstallations(token: string): Promise<GitHubInstallation[]> {
  const r = await api<{ installations?: RawInstallation[] }>(token, `/user/installations?per_page=${PAGE}`);
  return (r.installations ?? []).flatMap((i) => {
    if (typeof i.id !== 'number' || typeof i.account?.login !== 'string') return [];
    const manageUrl = typeof i.html_url === 'string' && i.html_url.startsWith(`${WEB}/`) ? i.html_url : `${WEB}/settings/installations/${i.id}`;
    return [{ id: i.id, account: i.account.login, organization: i.account.type === 'Organization', selection: i.repository_selection === 'all' ? 'all' : 'selected', manageUrl }];
  });
}

// Onde o app está instalado (a conta da pessoa, organizações): o que ela liberou em cada uma.
export async function installationCount(token: string): Promise<number> {
  const r = await api<{ total_count?: unknown }>(token, '/user/installations?per_page=1');
  return typeof r.total_count === 'number' ? r.total_count : 0;
}

// Os repositórios liberados, do mais mexido para o menos.
export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const out = new Map<string, GitHubRepo>();
  const installs = await api<{ installations?: { id?: unknown }[] }>(token, `/user/installations?per_page=${PAGE}`);
  for (const install of installs.installations ?? []) {
    if (typeof install.id !== 'number') continue;
    for (let page = 1; out.size < MAX_REPOS; page++) {
      const r = await api<{ repositories?: RawRepo[] }>(token, `/user/installations/${install.id}/repositories?per_page=${PAGE}&page=${page}`);
      const list = r.repositories ?? [];
      for (const raw of list) {
        const repo = readRepo(raw);
        if (repo) out.set(repo.fullName, repo);
      }
      if (list.length < PAGE) break;
    }
  }
  return [...out.values()].sort((a, b) => (b.pushedAt ?? 0) - (a.pushedAt ?? 0));
}

// Desconectar desfaz a autorização no GitHub também (a pessoa não precisa ir lá). Falha aqui não
// impede: a chave já saiu do banco.
export async function revokeGrant(config: Config, accessToken: string): Promise<void> {
  const { clientId, clientSecret } = credentials(config);
  const res = await githubHttp.fetch(`${API}/applications/${encodeURIComponent(clientId)}/grant`, {
    method: 'DELETE',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/json',
      'user-agent': 'Argus',
    },
    body: JSON.stringify({ access_token: accessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 204) throw new Error(`GitHub respondeu ${res.status} ao desfazer a autorização`);
}
