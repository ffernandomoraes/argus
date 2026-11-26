import { useSyncExternalStore } from 'react';

// Rotas pela parte do endereço depois do # (a ponte só serve arquivos; o # nunca sai do aparelho).
// #/                     aba Conversas (início)
// #/projects             aba Projetos
// #/folder/<pasta>       conversas de uma pasta
// #/chat/<pasta>/<id>    uma conversa (id: a sessão, ou "new-..." para uma nova)
// #/settings             aba Conta (uso e ajustes)
// #/usage                uso do Claude em detalhe
// #/add-folder/<board>   adicionar uma pasta ao workspace
// #pair=<código>         pareamento vindo do QR code
// #account=<código>      volta do login da conta do Argus (ver net/account.ts)
// #account-error=<motivo> o login não deu certo

export type Route =
  | { name: 'home' }
  | { name: 'projects' }
  | { name: 'folder'; path: string }
  | { name: 'chat'; cwd: string; id: string }
  | { name: 'settings' }
  | { name: 'usage' }
  | { name: 'addFolder'; board: string }
  | { name: 'pair'; code: string }
  | { name: 'account'; code: string }
  | { name: 'accountError'; error: string };

export function parseRoute(hash: string): Route {
  const pair = /^#pair=([^&]+)/.exec(hash);
  if (pair) return { name: 'pair', code: decodeURIComponent(pair[1]) };
  const account = /^#account=([\w-]+)/.exec(hash);
  if (account) return { name: 'account', code: account[1] };
  const accountError = /^#account-error=(\w+)/.exec(hash);
  if (accountError) return { name: 'accountError', error: accountError[1] };
  const parts = hash.replace(/^#\/?/, '').split('/').map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts[0] === 'folder' && parts[1]) return { name: 'folder', path: parts[1] };
  if (parts[0] === 'chat' && parts[1] && parts[2]) return { name: 'chat', cwd: parts[1], id: parts[2] };
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'usage') return { name: 'usage' };
  if (parts[0] === 'add-folder' && parts[1]) return { name: 'addFolder', board: parts[1] };
  return { name: 'home' };
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'folder':
      return `#/folder/${encodeURIComponent(route.path)}`;
    case 'chat':
      return `#/chat/${encodeURIComponent(route.cwd)}/${encodeURIComponent(route.id)}`;
    case 'projects':
      return '#/projects';
    case 'settings':
      return '#/settings';
    case 'usage':
      return '#/usage';
    case 'addFolder':
      return `#/add-folder/${encodeURIComponent(route.board)}`;
    case 'pair':
      return `#pair=${encodeURIComponent(route.code)}`;
    case 'account':
    case 'accountError':
      return '#/';
    default:
      return '#/';
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => location.hash);
}

// No app instalado do iPhone, as telas não entram no histórico do navegador: o arrastar da borda do
// próprio Safari voltava a página dele (com a foto da tela de antes deslizando), e não a tela do app.
// Lá, as telas de trás ficam guardadas aqui, e o arrastar chama o mesmo voltar do botão (ver
// ui/useEdgeSwipeBack.ts). No navegador e no Android, segue o histórico (botão e gesto de voltar do sistema).
export const ownHistory = (navigator as { standalone?: boolean }).standalone === true;
const behind: string[] = [];

// Profundidade dentro do app, guardada em cada passo do histórico: com ela, "voltar" sabe se há
// uma tela do app para trás (aberto por uma notificação, não há).
const depth = (): number => {
  const d = (history.state as { depth?: unknown } | null)?.depth;
  return typeof d === 'number' ? d : 0;
};

const changed = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export function go(route: Route): void {
  if (ownHistory) {
    behind.push(location.hash || '#/');
    history.replaceState(null, '', routeHash(route));
  } else history.pushState({ depth: depth() + 1 }, '', routeHash(route));
  changed();
}

// Troca o endereço sem criar uma volta no histórico (conversa nova que ganhou a sessão).
export function replace(route: Route): void {
  history.replaceState(ownHistory ? null : { depth: depth() }, '', routeHash(route));
  changed();
}

// Volta pelo histórico quando a tela veio de dentro do app; senão, para a tela de cima.
export function back(fallback: Route): void {
  if (ownHistory) {
    history.replaceState(null, '', behind.pop() ?? routeHash(fallback));
    changed();
  } else if (depth() > 0) history.back();
  else replace(fallback);
}

// Volta para o início sem deixar volta (antes de recarregar, ao esquecer o computador).
export function resetToStart(): void {
  behind.length = 0;
  history.replaceState(null, '', '#/');
}
