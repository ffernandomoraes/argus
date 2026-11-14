import type { WebPushSubscription } from '@argus/shared/webRemote';
import type { HostConnection } from '../net/connection';
import { tr } from '../i18n';

// Notificações do navegador (Web Push). No iPhone só existem com o app na Tela de Início (iOS 16.4+),
// e o pedido de permissão só aparece no toque da pessoa. O computador só manda aviso para o aparelho
// cuja inscrição ele tem: ela vai a cada conexão (ver syncPush), não só ao ligar.

export const isIos = () => /iPhone|iPad/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

// Aberto como app, em janela própria. No computador, o Chrome e o Edge abrem o app instalado também
// em "minimal-ui" ou com a barra de título dele (window-controls-overlay); só "standalone" deixava o
// app instalado no Mac preso na tela de instalar.
const APP_DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
export const installed = () =>
  APP_DISPLAY_MODES.some((mode) => matchMedia(`(display-mode: ${mode})`).matches) || (navigator as { standalone?: boolean }).standalone === true;

// Celular e tablet: o app só roda instalado (no iPhone, as notificações só existem assim). No
// computador, roda também numa aba do navegador.
export const isPhone = () => isIos() || /Android/.test(navigator.userAgent);
export const needsInstall = () => isPhone() && !installed();

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// ok: dá para ligar (permissão ainda não pedida ou já dada). install: iPhone fora da Tela de Início.
export type PushAvailability = 'ok' | 'install' | 'unsupported' | 'denied';

export function pushAvailability(): PushAvailability {
  if (!pushSupported()) return isIos() && !installed() ? 'install' : 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'ok';
}

export function availabilityMessage(a: Exclude<PushAvailability, 'ok'>): string {
  if (a === 'install') {
    return tr(
      'No iPhone, as notificações só funcionam com o app na Tela de Início: toque em Compartilhar e em "Adicionar à Tela de Início", e abra por lá.',
      'On iPhone, notifications only work with the app on the Home Screen: tap Share, then "Add to Home Screen", and open it from there.',
    );
  }
  if (a === 'denied') {
    return isIos()
      ? tr(
          'As notificações estão bloqueadas para o Argus. Libere em Ajustes do iPhone > Notificações > Argus > Permitir Notificações e volte aqui.',
          'Notifications are blocked for Argus. Allow them in iPhone Settings > Notifications > Argus > Allow Notifications, then come back.',
        )
      : tr('As notificações estão bloqueadas para o Argus. Libere nas configurações do navegador e volte aqui.', 'Notifications are blocked for Argus. Allow them in the browser settings, then come back.');
  }
  return isIos()
    ? tr('Este iPhone não tem notificações para apps da Tela de Início: precisa do iOS 16.4 ou mais novo.', 'This iPhone has no notifications for Home Screen apps: it needs iOS 16.4 or later.')
    : tr('Este navegador não tem notificações.', 'This browser has no notifications.');
}

// A escolha feita neste aparelho: ligou (on), desligou nos Ajustes (off) ou pulou o passo da entrada
// (skipped). Sem nada: ainda não decidiu, e a entrada pergunta.
type PushChoice = 'on' | 'off' | 'skipped';
const CHOICE_KEY = 'argus-push-choice';

export function pushChoice(): PushChoice | null {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === 'on' || v === 'off' || v === 'skipped' ? v : null;
  } catch {
    return null;
  }
}

export function setPushChoice(choice: PushChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // sem armazenamento: a entrada pergunta de novo da próxima vez
  }
}

const unb64url = (t: string) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const b64url = (buf: ArrayBuffer | null) => {
  if (!buf) return '';
  let s = '';
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {});
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function toWire(sub: PushSubscription): WebPushSubscription {
  return { endpoint: sub.endpoint, p256dh: b64url(sub.getKey('p256dh')), auth: b64url(sub.getKey('auth')) };
}

const SW_WAIT_MS = 10_000;
const KEY_WAIT_MS = 15_000;

// O service worker pronto; registro que falhou deixaria o `ready` esperando para sempre.
function serviceWorker(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(tr('O app não conseguiu preparar as notificações. Feche o Argus, abra de novo e tente outra vez.', "The app couldn't set up notifications. Close Argus, open it again and retry."))),
        SW_WAIT_MS,
      ),
    ),
  ]);
}

// A chave com que o computador assina os avisos; chega com a conexão (espera ela ficar pronta).
function pushKey(conn: HostConnection): Promise<string | null> {
  if (conn.status === 'online') return Promise.resolve(conn.info?.pushKey ?? null);
  return new Promise((resolve) => {
    const finish = (key: string | null) => {
      clearTimeout(timer);
      off();
      resolve(key);
    };
    const timer = setTimeout(() => finish(null), KEY_WAIT_MS);
    const off = conn.onStatus(() => conn.status === 'online' && finish(conn.info?.pushKey ?? null));
  });
}

// A inscrição para a chave do computador: a que já existe, ou uma nova (a de outra chave sai).
async function subscribeWith(key: string): Promise<PushSubscription> {
  const reg = await serviceWorker();
  const sub = await reg.pushManager.getSubscription();
  const appKey = sub?.options.applicationServerKey;
  if (sub && (!appKey || b64url(appKey) === key)) return sub;
  await sub?.unsubscribe();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(key) });
}

// Liga e manda a inscrição ao computador. Chamar direto do toque: a permissão é pedida antes de
// qualquer espera (o iPhone só mostra o pedido assim). Erro em texto, ou nulo.
export async function enablePush(conn: HostConnection): Promise<string | null> {
  const availability = pushAvailability();
  if (availability !== 'ok') return availabilityMessage(availability);
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return availabilityMessage('denied');
  if (permission !== 'granted') return tr('As notificações não foram liberadas.', 'Notifications were not allowed.');
  const key = await pushKey(conn);
  if (!key) return tr('Sem ligação com o computador. Tente de novo quando ele estiver conectado.', 'No connection to the computer. Try again once it is connected.');
  conn.setPush(toWire(await subscribeWith(key)));
  setPushChoice('on');
  return null;
}

// O computador fica sabendo antes de qualquer espera (quem chama pode fechar a conexão em seguida).
export async function disablePush(conn: HostConnection): Promise<void> {
  setPushChoice('off');
  conn.setPush(null);
  await (await currentSubscription())?.unsubscribe();
}

// Esquecer o computador: ele perde a inscrição, e o próximo pareamento pergunta de novo.
export async function forgetPush(conn: HostConnection): Promise<void> {
  try {
    localStorage.removeItem(CHOICE_KEY);
  } catch {
    // sem armazenamento: nada guardado
  }
  conn.setPush(null);
  await (await currentSubscription())?.unsubscribe();
}

// A cada conexão pronta: o computador recebe de novo a inscrição deste aparelho. Sem isto, um
// pareamento novo (ou o computador que perdeu a inscrição) deixava o celular achando que as
// notificações estavam ligadas sem nenhuma chegar. Só com a permissão já dada (não pede nada).
export async function syncPush(conn: HostConnection): Promise<void> {
  const key = conn.info?.pushKey;
  if (!key || pushAvailability() !== 'ok' || Notification.permission !== 'granted') return;
  const choice = pushChoice();
  if (choice === 'off' || choice === 'skipped') return;
  // Ligadas antes de a escolha ser guardada: vale a inscrição que existe.
  if (choice === null && !(await currentSubscription())) return;
  conn.setPush(toWire(await subscribeWith(key)));
  if (choice === null) setPushChoice('on');
}

// O passo da entrada pergunta só a quem ainda não decidiu e pode ligar agora.
export const mayAskForPush = () => pushChoice() === null && pushAvailability() === 'ok' && (!needsInstall() || import.meta.env.DEV);
