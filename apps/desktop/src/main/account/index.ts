import { app } from 'electron';
import type { AccountDevice, AccountError, AccountProvider, AccountState, AccountSync } from '@argus/shared/account';
import type { ClaudeAction, ClaudeItem } from '@argus/shared/accountClaude';
import type { RendererSyncValues } from '@argus/shared/accountSync';
import type { AccountComputer, WorkspaceImportResult } from '@argus/shared/accountWorkspaces';
import type { AccountBridge } from '../remote/accountRemote';
import { ClaudeLibrary } from './claudeSync';
import { NoticeStream, type IncomingNotice } from './notices';
import { downloadAvatar } from './avatar';
import { GitHubConnection } from './github';
import { accountRequest, isUnauthorized } from './http';
import { applyMainValues, readMainValues, type MainSettingsHooks } from './mainSettings';
import { loadAccountFile, readDevices, readProfile, saveAccountFile, type AccountFile } from './profile';
import { SignInFlow } from './signIn';
import { SyncRunner } from './syncRunner';
import { deleteSessionToken, readSessionToken, saveSessionToken } from './tokenStore';
import { importBoard, listComputers, uploadSnapshot, type BoardSource } from './workspaces';

// Conta do Argus neste computador: o login (signIn.ts), a sessão no cofre (tokenStore.ts), as
// preferências sincronizadas (syncRunner.ts), o desenho dos workspaces (workspaces.ts) e os arquivos
// do Claude (claudeSync.ts). A tela fica em Configurações > Perfil. Busca na conta
// ao abrir, ao voltar para o app (no máximo a cada minuto) e a cada 10 minutos; envia logo depois de
// cada mudança.

const PUSH_DELAY_MS = 1500;
const FOCUS_EVERY_MS = 60_000;
const POLL_EVERY_MS = 10 * 60_000;
const STARTUP_DELAY_MS = 5_000;

export type AccountDeps = {
  settings: MainSettingsHooks
  emitState(state: AccountState): void
  // Preferências das janelas que vieram da conta.
  applyRenderer(values: RendererSyncValues): void
  // O Argus volta para a frente depois do login no navegador.
  showApp(): void
  // Os workspaces deste computador (lidos só quando precisa: nascem depois da conta).
  boards(): BoardSource
  // Avisos entre computadores (ver notices.ts): ninguém na frente deste computador agora? a sala
  // dele no acesso remoto (para o aviso abrir o computador), e mostrar o aviso que chegou.
  away(): boolean
  remoteHostId(): string | null
  showNotice(notice: IncomingNotice): void
  // Os aparelhos que parearam com este computador pela conta (ver remote/accountDevices.ts).
  remoteDevices: { removed(sessionId: string): void; check(): void; accountGone(): void }
};

const IDLE_SYNC: AccountSync = { status: 'idle', lastSyncedAt: null, first: null };

export class AccountService {
  private file: AccountFile;
  // Lido do cofre só com o app pronto: antes disso, o cofre do Windows e do Linux responde que não existe.
  private token: string | null = null;
  private signingIn: AccountProvider | null = null;
  private attempt = 0;
  private error: AccountError | null = null;
  private sync: AccountSync = IDLE_SYNC;
  private readonly flow = new SignInFlow();
  private readonly runner: SyncRunner;
  private readonly claude: ClaudeLibrary;
  private readonly notices: NoticeStream;
  // GitHub conectado à conta, para clonar (ver github.ts).
  readonly github: GitHubConnection;
  private pushTimer: NodeJS.Timeout | null = null;
  private lastRun = 0;
  private bridge: { token: string; bridge: AccountBridge } | null = null;

  constructor(private readonly deps: AccountDeps) {
    this.file = loadAccountFile();
    this.runner = new SyncRunner(this.file.memory, {
      token: () => this.token,
      readMain: () => readMainValues(deps.settings),
      applyMain: (values) => applyMainValues(values, deps.settings),
      applyRenderer: (values) => deps.applyRenderer(values),
      saveMemory: (memory) => this.save({ memory }),
    });
    this.notices = new NoticeStream({
      notice: (notice) => deps.showNotice(notice),
      deviceRemoved: (sessionId) => deps.remoteDevices.removed(sessionId),
      opened: () => deps.remoteDevices.check(),
      unauthorized: () => this.clearLocal('revoked'),
    });
    this.github = new GitHubConnection({
      request: this.request,
      signedIn: () => !!this.token,
      failed: (err) => this.failed(err, false),
      showApp: () => deps.showApp(),
    });
    this.claude = new ClaudeLibrary(this.request, {
      get: () => this.file.claudeKnown,
      set: (claudeKnown) => this.save({ claudeKnown }),
    });
  }

  start(): void {
    void app.whenReady().then(() => {
      this.token = this.file.profile ? readSessionToken() : null;
      if (this.token) this.notices.start(this.token);
      this.emit();
      app.on('browser-window-focus', () => {
        if (Date.now() - this.lastRun > FOCUS_EVERY_MS) void this.runSync();
      });
      setInterval(() => void this.runSync(), POLL_EVERY_MS).unref();
      setTimeout(() => {
        void this.refreshProfile();
        void this.runSync();
      }, STARTUP_DELAY_MS).unref();
    });
  }

  state(): AccountState {
    if (this.signingIn) return { status: 'signingIn', provider: this.signingIn };
    if (this.token && this.file.profile) return { status: 'signedIn', profile: this.file.profile, sync: this.sync };
    return { status: 'signedOut', error: this.error };
  }

  async signIn(provider: AccountProvider): Promise<void> {
    if (this.token) return;
    const attempt = ++this.attempt;
    this.signingIn = provider;
    this.error = null;
    this.emit();
    const r = await this.flow.run(provider);
    // Outro login começou no meio (o anterior foi cancelado): ele que decide a tela.
    if (attempt !== this.attempt) return;
    this.signingIn = null;
    const raw = r.ok ? (r.profile as { avatarUrl?: unknown } | null) : null;
    const avatarUrl = typeof raw?.avatarUrl === 'string' ? raw.avatarUrl : null;
    const profile = r.ok ? readProfile(raw, await downloadAvatar(avatarUrl)) : null;
    if (!r.ok || !profile) {
      this.error = r.ok ? 'failed' : r.error;
      return this.emit();
    }
    try {
      saveSessionToken(r.token);
    } catch (err) {
      console.warn('[account] não deu para guardar a sessão no cofre:', err);
      this.error = 'failed';
      return this.emit();
    }
    this.token = r.token;
    this.notices.start(r.token);
    this.save({ profile, avatarUrl, adoptPending: true });
    this.deps.showApp();
    await this.runSync();
  }

  cancelSignIn(): void {
    this.flow.cancel();
  }

  async signOut(): Promise<void> {
    const token = this.token;
    this.clearLocal(null);
    if (!token) return;
    await accountRequest('/api/logout', { method: 'POST', token }).catch((err) => console.warn('[account] saída no servidor falhou:', err));
  }

  async devices(): Promise<AccountDevice[] | null> {
    const r = await this.authed<{ devices?: unknown }>('/api/devices');
    return r ? readDevices(r.devices) : null;
  }

  async removeDevice(id: string): Promise<boolean> {
    return (await this.authed(`/api/devices/${encodeURIComponent(id)}`, 'DELETE')) !== undefined;
  }

  // Apaga no servidor e sai daqui. Falso: não deu (sem rede).
  async deleteAccount(): Promise<boolean> {
    if ((await this.authed('/api/me', 'DELETE')) === undefined) return false;
    this.clearLocal(null);
    return true;
  }

  // A janela contou as preferências dela (ao abrir e a cada mudança).
  reportPrefs(prefs: RendererSyncValues): void {
    this.runner.report(prefs, !!this.token);
    this.schedulePush();
  }

  // Mudou uma preferência do processo principal nas Configurações.
  mainChanged(): void {
    if (!this.token) return;
    this.runner.mainChanged();
    this.schedulePush();
  }

  syncNow(): void {
    void this.runSync();
  }

  // Aviso de conversa deste computador: vai para os outros da conta só sem ninguém na frente daqui.
  shareNotice(notice: { title: string; body: string; kind: string }): void {
    if (!this.token || !this.deps.away()) return;
    const hostId = this.deps.remoteHostId();
    void this.request('/api/notices', 'POST', { ...notice, ...(hostId && { hostId }) }).catch((err: unknown) => {
      console.warn('[account] aviso não foi para os outros computadores:', err instanceof Error ? err.message : err);
    });
  }

  async computers(): Promise<AccountComputer[] | null> {
    return this.guarded(() => listComputers(this.request));
  }

  async importWorkspace(computerId: string, boardId: string): Promise<WorkspaceImportResult> {
    const r = await this.guarded(() => importBoard(this.deps.boards(), this.request, computerId, boardId));
    return r ?? { ok: false, error: 'offline' };
  }

  async claudeItems(): Promise<ClaudeItem[] | null> {
    return this.guarded(() => this.claude.refresh());
  }

  async claudeAct(action: ClaudeAction, keys: string[]): Promise<ClaudeItem[] | null> {
    return this.guarded(() => this.claude.act(action, keys));
  }

  // Pedido autenticado para os módulos (workspaces, instruções e skills). Sem login: falha.
  // A conta para o acesso remoto (ver remote/accountRemote.ts): a mesma enquanto o login for o mesmo.
  // Nula: sem conta neste computador.
  remoteBridge(): AccountBridge | null {
    if (!this.token) return null;
    if (this.bridge?.token !== this.token) this.bridge = { token: this.token, bridge: { request: (path, method, body) => this.request(path, method, body) } };
    return this.bridge.bridge;
  }

  private readonly request = <T>(path: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<T | null> => {
    if (!this.token) return Promise.reject(new Error('sem login'));
    return accountRequest<T>(path, { method, token: this.token, body });
  };

  // Roda com login; nulo se não deu (sem rede, sessão encerrada), sem derrubar a tela.
  private async guarded<T>(run: () => Promise<T>): Promise<T | null> {
    if (!this.token) return null;
    try {
      return await run();
    } catch (err) {
      this.failed(err, false);
      return null;
    }
  }

  // Desenho dos workspaces e instruções e skills dos agentes, depois das preferências. Falha aqui não marca a
  // sincronização das preferências como falha: tenta de novo na próxima rodada.
  private async syncExtras(): Promise<void> {
    try {
      const sent = await uploadSnapshot(this.deps.boards(), this.file.workspacesSent, this.request);
      if (sent !== this.file.workspacesSent) this.save({ workspacesSent: sent });
    } catch (err) {
      this.failed(err, false);
    }
    if (this.token) await this.guarded(() => this.claude.refresh());
  }

  private schedulePush(): void {
    if (!this.token || !this.runner.hasPending) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.runSync();
    }, PUSH_DELAY_MS);
  }

  private async runSync(): Promise<void> {
    if (!this.token || this.signingIn) return;
    this.lastRun = Date.now();
    this.setSync({ status: 'syncing' });
    try {
      if (this.file.adoptPending) {
        const first = await this.runner.adopt();
        this.save({ adoptPending: false });
        this.setSync({ status: 'idle', lastSyncedAt: Date.now(), first });
      } else {
        await this.runner.run();
        this.setSync({ status: 'idle', lastSyncedAt: Date.now() });
      }
    } catch (err) {
      this.failed(err);
      return;
    }
    await this.syncExtras();
  }

  // Perfil de novo (um login ligado em outro computador, a foto trocada).
  private async refreshProfile(): Promise<void> {
    const r = await this.authed<{ profile?: { avatarUrl?: unknown } }>('/api/me');
    if (!r?.profile || !this.token) return;
    const url = typeof r.profile.avatarUrl === 'string' ? r.profile.avatarUrl : null;
    const avatar = url === this.file.avatarUrl ? (this.file.profile?.avatar ?? null) : await downloadAvatar(url);
    const profile = readProfile(r.profile, avatar);
    if (!profile || !this.token) return;
    this.save({ profile, avatarUrl: url });
    this.emit();
  }

  // Pedido de quem entrou. undefined: não deu (sem rede, sessão encerrada, sem login).
  private async authed<T>(path: string, method: 'GET' | 'DELETE' = 'GET'): Promise<T | null | undefined> {
    if (!this.token) return undefined;
    try {
      return await accountRequest<T>(path, { method, token: this.token });
    } catch (err) {
      this.failed(err, false);
      return undefined;
    }
  }

  private failed(err: unknown, showInSync = true): void {
    if (isUnauthorized(err)) return this.clearLocal('revoked');
    console.warn('[account] pedido à conta falhou:', err instanceof Error ? err.message : err);
    if (showInSync) this.setSync({ status: 'error' });
  }

  // Sai neste computador: a sessão some do cofre e o combinado com a conta é esquecido.
  private clearLocal(error: AccountError | null): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = null;
    try {
      deleteSessionToken();
    } catch (err) {
      console.warn('[account] não deu para apagar a sessão:', err);
    }
    this.token = null;
    this.notices.stop();
    this.github.forget();
    // O acesso remoto aberto pela conta acaba junto com ela neste computador.
    this.deps.remoteDevices.accountGone();
    this.file = { ...this.file, profile: null, avatarUrl: null, adoptPending: false, workspacesSent: null, claudeKnown: {} };
    this.runner.reset();
    this.claude.forget();
    this.sync = IDLE_SYNC;
    this.error = error;
    this.emit();
  }

  private save(patch: Partial<AccountFile>): void {
    this.file = { ...this.file, ...patch };
    saveAccountFile(this.file);
  }

  private setSync(patch: Partial<AccountSync>): void {
    this.sync = { ...this.sync, ...patch };
    this.emit();
  }

  private emit(): void {
    this.deps.emitState(this.state());
  }
}
