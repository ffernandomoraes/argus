import type { WebPushSubscription } from '@argus/shared/webRemote'
import type { HostConnection } from '../net/connection'
import { tr } from '../i18n'

// Notificações do navegador (Web Push). No iPhone só existem com o app na Tela de Início (iOS 16.4+).

export const isIos = () => /iPhone|iPad/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)

export const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const unb64url = (t: string) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const b64url = (buf: ArrayBuffer | null) => {
  if (!buf) return ''
  let s = ''
  for (const x of new Uint8Array(buf)) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

function toWire(sub: PushSubscription): WebPushSubscription {
  return { endpoint: sub.endpoint, p256dh: b64url(sub.getKey('p256dh')), auth: b64url(sub.getKey('auth')) }
}

// Liga (pedindo a permissão, no toque da pessoa) e manda a inscrição ao computador. Erro em texto, ou nulo.
export async function enablePush(conn: HostConnection): Promise<string | null> {
  if (!pushSupported()) return tr('Este navegador não tem notificações. No iPhone, adicione o app à Tela de Início primeiro.', 'This browser has no notifications. On iPhone, add the app to the Home Screen first.')
  const key = conn.info?.pushKey
  if (!key) return tr('Sem ligação com o computador.', 'No connection to the computer.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return tr('As notificações foram recusadas. Libere nos ajustes do celular.', 'Notifications were denied. Allow them in the phone settings.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  // Inscrição de outra chave (o computador trocou de chave): troca.
  const appKey = sub?.options.applicationServerKey
  if (sub && appKey && b64url(appKey) !== key) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(key) })
  conn.setPush(toWire(sub))
  return null
}

export async function disablePush(conn: HostConnection): Promise<void> {
  const sub = await currentSubscription()
  await sub?.unsubscribe()
  conn.setPush(null)
}
