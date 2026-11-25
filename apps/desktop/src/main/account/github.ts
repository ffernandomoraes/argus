import { createHash, randomBytes } from 'node:crypto';
import { shell } from 'electron';
import {
  githubHttpsUrl,
  isGitHubPage,
  readInstallations,
  readRepos,
  type GitHubConnectResult,
  type GitHubInstallationList,
  type GitHubRepoList,
  type GitHubStatus,
} from '@argus/shared/accountGitHub';
import { lang } from '../i18n';
import { AccountHttpError, accountUrl } from './http';
import { openLoopback } from './loopback';

// GitHub conectado à conta do Argus (app "Argus" no GitHub, só leitura dos repositórios liberados).
// Conectar é como o login (signIn.ts): o navegador passa pelo GitHub e volta para 127.0.0.1 com um
// código que só vale com o segredo sorteado aqui. A chave fica no servidor; o app pede uma na hora
// do clone (vence em até 8 horas) e guarda só na memória.

const TIMEOUT_MS = 10 * 60_000;
// A chave guardada vale para um clone só se ainda tiver esse tempo pela frente.
const TOKEN_MARGIN_MS = 15 * 60_000;
// Onde a pessoa vê as instalações de apps do GitHub dela, se o servidor mandar um endereço estranho.
const INSTALLATIONS_PAGE = 'https://github.com/settings/installations';

type Request = <T>(path: string, method?: 'GET' | 'PUT' | 'POST' | 'DELETE', body?: unknown) => Promise<T | null>;

export type GitHubDeps = {
  request: Request
  signedIn(): boolean
  // Pedido que falhou: 401 tira a conta daqui (ver AccountService.failed).
  failed(err: unknown): void
  showApp(): void
};

const notConnected = (err: unknown) => err instanceof AccountHttpError && err.status === 409;

export class GitHubConnection {
  private cancelCurrent: (() => void) | null = null;
  private token: { value: string; expiresAt: number | null } | null = null;

  constructor(private readonly deps: GitHubDeps) {}

  async status(): Promise<GitHubStatus> {
    if (!this.deps.signedIn()) return { status: 'signedOut' };
    try {
      const r = await this.deps.request<{ available?: unknown; login?: unknown; installUrl?: unknown }>('/api/github');
      if (r?.available !== true) return { status: 'unavailable' };
      if (typeof r.login !== 'string') return { status: 'disconnected' };
      // O endereço abre no navegador: só uma página do github.com.
      return { status: 'connected', login: r.login.slice(0, 100), installUrl: isGitHubPage(r.installUrl) ? r.installUrl : INSTALLATIONS_PAGE };
    } catch (err) {
      this.deps.failed(err);
      return { status: this.deps.signedIn() ? 'offline' : 'signedOut' };
    }
  }

  cancel(): void {
    this.cancelCurrent?.();
  }

  async connect(): Promise<GitHubConnectResult> {
    if (!this.deps.signedIn()) return { ok: false, error: 'signedOut' };
    this.cancel();
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    let loopback;
    try {
      loopback = await openLoopback();
    } catch (err) {
      console.warn('[account] GitHub: não deu para esperar a volta do navegador:', err);
      return { ok: false, error: 'failed' };
    }
    const language = lang();
    const done = (status: string) => `${accountUrl()}/auth/done?status=${status}&lang=${language}`;
    let timer: NodeJS.Timeout | undefined;
    let mine: (() => void) | null = null;
    const stopped = new Promise<'canceled' | 'expired'>((resolve) => {
      timer = setTimeout(() => resolve('expired'), TIMEOUT_MS);
      mine = () => resolve('canceled');
      this.cancelCurrent = mine;
    });
    void shell.openExternal(`${accountUrl()}/github/start?${new URLSearchParams({ port: String(loopback.port), challenge, lang: language })}`);

    try {
      const back = await Promise.race([loopback.result, stopped]);
      if (back === 'canceled' || back === 'expired') {
        loopback.close();
        return { ok: false, error: back };
      }
      if ('error' in back) {
        loopback.finish(done(back.error));
        return { ok: false, error: back.error === 'denied' ? 'denied' : 'failed' };
      }
      try {
        const r = await this.deps.request<{ login?: unknown; installed?: unknown; installUrl?: unknown }>('/api/github/link', 'POST', { code: back.code, verifier });
        const login = typeof r?.login === 'string' ? r.login : '';
        // O navegador segue para a instalação do app: a pessoa escolhe a conta ou a organização e os
        // repositórios que o Argus vê (volta pela página /github/installed do servidor).
        const install = isGitHubPage(r?.installUrl) ? r.installUrl : null;
        loopback.finish(install ?? done('linked'));
        if (!install) this.deps.showApp();
        return { ok: true, login };
      } catch (err) {
        console.warn('[account] GitHub: conexão não concluída:', err instanceof Error ? err.message : err);
        loopback.finish(done('error'));
        this.deps.failed(err);
        return { ok: false, error: err instanceof AccountHttpError ? 'failed' : 'offline' };
      }
    } finally {
      clearTimeout(timer);
      if (this.cancelCurrent === mine) this.cancelCurrent = null;
    }
  }

  repos(): Promise<GitHubRepoList> {
    return this.list('/api/github/repos', (r) => ({ ok: true, repos: readRepos(r.repos) }));
  }

  installations(): Promise<GitHubInstallationList> {
    return this.list('/api/github/installations', (r) => ({ ok: true, installations: readInstallations(r.installations) }));
  }

  private async list<T>(path: string, read: (body: Record<string, unknown>) => T): Promise<T | { ok: false; error: 'signedOut' | 'notConnected' | 'offline' | 'failed' }> {
    if (!this.deps.signedIn()) return { ok: false, error: 'signedOut' };
    try {
      return read((await this.deps.request<Record<string, unknown>>(path)) ?? {});
    } catch (err) {
      if (notConnected(err)) return { ok: false, error: 'notConnected' };
      this.deps.failed(err);
      if (!this.deps.signedIn()) return { ok: false, error: 'signedOut' };
      return { ok: false, error: err instanceof AccountHttpError ? 'failed' : 'offline' };
    }
  }

  async disconnect(): Promise<boolean> {
    if (!this.deps.signedIn()) return false;
    this.token = null;
    try {
      await this.deps.request('/api/github', 'DELETE');
      return true;
    } catch (err) {
      this.deps.failed(err);
      return false;
    }
  }

  // A chave para clonar `url`, se for do github.com e o GitHub estiver conectado. Nula: o clone vai
  // sem ela (o git deste computador, se tiver login, ainda serve).
  async cloneToken(url: string): Promise<string | null> {
    if (!githubHttpsUrl(url) || !this.deps.signedIn()) return null;
    if (this.token && (this.token.expiresAt === null || this.token.expiresAt - Date.now() > TOKEN_MARGIN_MS)) return this.token.value;
    try {
      const r = await this.deps.request<{ token?: unknown; expiresAt?: unknown }>('/api/github/token', 'POST');
      if (typeof r?.token !== 'string') return null;
      this.token = { value: r.token, expiresAt: typeof r.expiresAt === 'number' ? r.expiresAt : null };
      return r.token;
    } catch (err) {
      if (!notConnected(err)) this.deps.failed(err);
      return null;
    }
  }

  // Saiu da conta neste computador.
  forget(): void {
    this.cancel();
    this.token = null;
  }
}
