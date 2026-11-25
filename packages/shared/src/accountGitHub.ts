// GitHub conectado à conta do Argus (app "Argus" no GitHub, só leitura dos repositórios que a pessoa
// liberou): a lista para clonar em "Nova pasta" e a chave que o git clone usa, inclusive no "Clonar…"
// de um workspace importado. Servidor em apps/account/src/modules/github; app em
// apps/desktop/src/main/account/github.ts.

export type GitHubRepo = {
  // "dono/nome".
  fullName: string
  name: string
  owner: string
  private: boolean
  description: string | null
  pushedAt: number | null
  // https://github.com/dono/nome.git
  cloneUrl: string
};

export type GitHubStatus =
  // Sem conta do Argus neste computador.
  | { status: 'signedOut' }
  // O servidor da conta não tem o app do GitHub configurado.
  | { status: 'unavailable' }
  | { status: 'offline' }
  | { status: 'disconnected' }
  // installUrl: onde escolher (ou mudar) os repositórios que o Argus vê.
  | { status: 'connected'; login: string; installUrl: string };

export type GitHubConnectResult =
  | { ok: true; login: string }
  | { ok: false; error: 'denied' | 'failed' | 'expired' | 'offline' | 'canceled' | 'signedOut' };

// Conta ou organização onde o app do Argus está instalado.
export type GitHubInstallation = {
  id: number
  account: string
  organization: boolean
  // all: todos os repositórios dela; selected: só os escolhidos.
  selection: 'all' | 'selected'
  // A página da instalação no GitHub: escolher repositórios ou desinstalar (desconectar).
  manageUrl: string
};

// failed: o servidor respondeu com erro (offline: nem chegou nele).
export type GitHubInstallationList = { ok: true; installations: GitHubInstallation[] } | { ok: false; error: 'signedOut' | 'notConnected' | 'offline' | 'failed' };

// Uma página do github.com (https, sem usuário, senha ou porta no endereço): o que o app abre no
// navegador quando o endereço vem do servidor.
export function isGitHubPage(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' && !u.port && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function readInstallations(raw: unknown): GitHubInstallation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i: Partial<Record<keyof GitHubInstallation, unknown>>) =>
    i && typeof i.id === 'number' && typeof i.account === 'string' && isGitHubPage(i.manageUrl)
      ? [{ id: i.id, account: i.account, organization: i.organization === true, selection: i.selection === 'all' ? 'all' : 'selected', manageUrl: i.manageUrl } as const]
      : [],
  );
}

export type GitHubRepoList = { ok: true; repos: GitHubRepo[] } | { ok: false; error: 'signedOut' | 'notConnected' | 'offline' | 'failed' };

// O endereço https do repositório no github.com (o que a chave do app abre), a partir de qualquer
// forma do endereço: https, git@github.com:dono/nome ou ssh://. Nulo: não é do github.com.
export function githubHttpsUrl(url: string): string | null {
  const m =
    /^https:\/\/(?:[^@/]+@)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url) ??
    /^(?:ssh:\/\/)?git@github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(url);
  return m ? `https://github.com/${m[1]}/${m[2]}.git` : null;
}

// A lista que veio do servidor, conferida. O endereço clonado tem que ser o do nome mostrado (o
// clone não pode trazer outro repositório no lugar), e vai sem usuário nem senha.
export function readRepos(raw: unknown): GitHubRepo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r: Partial<Record<keyof GitHubRepo, unknown>>) => {
    if (!r || typeof r.fullName !== 'string' || typeof r.name !== 'string' || typeof r.cloneUrl !== 'string') return [];
    const cloneUrl = githubHttpsUrl(r.cloneUrl);
    const named = githubHttpsUrl(`https://github.com/${r.fullName}.git`);
    if (!cloneUrl || !named || cloneUrl.toLowerCase() !== named.toLowerCase()) return [];
    return [
      {
        fullName: r.fullName,
        name: r.name,
        owner: typeof r.owner === 'string' ? r.owner : r.fullName.split('/')[0]!,
        private: r.private === true,
        description: typeof r.description === 'string' ? r.description : null,
        pushedAt: typeof r.pushedAt === 'number' ? r.pushedAt : null,
        cloneUrl,
      },
    ];
  });
}
