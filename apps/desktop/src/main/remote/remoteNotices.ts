import { BrowserWindow, Notification } from 'electron';
import { loadAppSettings } from '../appSettings';
import { attention, type Kind } from '../notifications';
import type { RemoteClient } from './client';

// O notebook avisando do que acontece nas conversas do computador de casa, como avisa das daqui: o
// número no ícone do app (Dock, barra de tarefas) soma as de lá, e a conversa que terminou, parou
// com erro ou precisa de você vira notificação do sistema. O de casa manda (ver services.ts e
// RemoteHost.notify); sem isso, só a tela do computador de casa, onde ninguém estava, avisava.

export const REMOTE_BADGE = 'remote:badge';
export const REMOTE_ALERT = 'remote:alert';

export type RemoteAlert = { title: string; body: string; kind: Kind; cwd: string; sessionId?: string };

const KINDS: readonly Kind[] = ['needs-you', 'done', 'error'];
// Guardadas até o clique (ver KEEP_SHOWN em notifications.ts).
const KEEP_SHOWN = 20;

const badges = new Map<RemoteClient, number>();
const shown = new Set<Notification>();
let onBadge: () => void = () => undefined;

// Quantas conversas para ver nos computadores ligados, somadas.
export function remoteBadgeTotal(): number {
  let total = 0;
  for (const n of badges.values()) total += n;
  return total;
}

export function onRemoteBadgeChange(listener: () => void): void {
  onBadge = listener;
}

export function remoteNotice(client: RemoteClient, ch: string, args: unknown[]): void {
  if (ch === REMOTE_BADGE) return setBadge(client, args[0]);
  if (ch === REMOTE_ALERT) return alert(client, args[0]);
}

// A ligação acabou: o número de lá sai do ícone.
export function forgetRemoteNotices(client: RemoteClient): void {
  if (badges.delete(client)) onBadge();
}

function setBadge(client: RemoteClient, value: unknown): void {
  const n = typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
  if (badges.get(client) === n) return;
  badges.set(client, n);
  onBadge();
}

function parseAlert(value: unknown): RemoteAlert | null {
  if (typeof value !== 'object' || value === null) return null;
  const a = value as Record<string, unknown>;
  if (typeof a.title !== 'string' || typeof a.body !== 'string' || typeof a.cwd !== 'string') return null;
  if (!KINDS.includes(a.kind as Kind)) return null;
  return { title: a.title, body: a.body, cwd: a.cwd, kind: a.kind as Kind, ...(typeof a.sessionId === 'string' && { sessionId: a.sessionId }) };
}

// Como as daqui: só com o app fora de foco (olhando o app, a janela de lá já mostra o status).
function alert(client: RemoteClient, value: unknown): void {
  const a = parseAlert(value);
  if (!a || BrowserWindow.getFocusedWindow()) return;
  attention(a.kind);
  const settings = loadAppSettings();
  if (!Notification.isSupported() || !settings.notifications) return;
  const host = client.info?.name;
  const n = new Notification({ title: host ? `${a.title} (${host})` : a.title, body: a.body, silent: !settings.notificationSound });
  n.on('click', () => {
    shown.delete(n);
    open(client, a);
  });
  n.on('close', () => shown.delete(n));
  shown.add(n);
  for (const old of shown) {
    if (shown.size <= KEEP_SHOWN) break;
    shown.delete(old);
  }
  n.show();
}

// Clique: traz a janela que mostra o computador de lá e abre a conversa nela.
function open(client: RemoteClient, a: RemoteAlert): void {
  const wc = client.firstWindow();
  const win = wc && !wc.isDestroyed() ? BrowserWindow.fromWebContents(wc) : null;
  if (!wc || !win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (a.sessionId) wc.send('chat:open', a.cwd, a.sessionId);
}
