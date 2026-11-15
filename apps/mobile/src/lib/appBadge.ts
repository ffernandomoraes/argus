import { useEffect } from 'react';
import { useActiveChats, useUnread } from './data';

// Número no ícone do app (iPhone a partir do iOS 16.4, com as notificações ligadas; Android com
// Chrome), como o do Argus no Dock: conversas com resposta que você ainda não viu, mais as que estão
// esperando você. Com o app aberto, segue a lista ao vivo; fechado, a notificação traz o número
// (public/sw.js).

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function setAppBadge(count: number): void {
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge) return;
  const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.();
  done?.catch(() => {});
}

export function AppBadge() {
  const unread = useUnread().ids;
  const active = useActiveChats();
  const ids = new Set(unread);
  for (const c of active) if (c.status === 'needs-you') ids.add(c.sessionId ?? c.key);
  const count = ids.size;
  useEffect(() => setAppBadge(count), [count]);
  return null;
}
