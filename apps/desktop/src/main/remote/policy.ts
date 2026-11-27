import type { InvokeChannels, SendChannels, SendSyncChannels } from '@argus/shared/ipc';
import { tr } from '../i18n';

// O que acontece com cada canal pedido por uma janela de acesso remoto (a janela, no notebook, que
// mostra o Argus de outro computador):
// - local: este Argus responde, porque é coisa da janela ou da máquina de quem está usando (tema,
//   zoom, copiar e colar, idioma, ditado: o microfone e a conta do Claude são os do notebook, e só
//   o texto entra no campo da conversa);
// - bloqueado: não faz sentido de longe (seletor de pastas, abrir no Finder,
//   área de transferência do outro computador); responde o valor padrão e não sai daqui;
// - o resto vai para o Argus do outro computador.
// O Argus de casa confere a mesma lista e recusa o que não for "remoto", mesmo que peçam.

export type ChannelPolicy = 'local' | 'blocked' | 'remote';

const LOCAL = new Set<string>([
  'theme:set',
  'interface:zoom',
  'clipboard:command',
  'language:get',
  'auth:open',
  'remote:info',
  'remote:openLocalhost',
  'speech:start',
  'speech:stop',
  'speech:audio',
  'speech:openSettings',
  // As favoritas da janela remota são as do notebook: não sobrescrevem as de casa.
  'favorites:set',
  // As preferências da janela remota são as do notebook: não sobrescrevem as de casa.
  'preferences:share',
  // Resposta da janela daqui a um pedido daqui (adicionar pasta pelo celular).
  'canvas:placedFolder',
  // A conta do Argus é de cada computador: a janela remota mexe na do notebook, nunca na de casa.
  'account:state',
  'account:devices',
  'account:removeDevice',
  'account:delete',
  'account:computers',
  'account:importWorkspace',
  'account:claudeItems',
  'account:claudeAct',
  'account:signIn',
  'account:cancelSignIn',
  'account:signOut',
  'account:syncNow',
  'account:reportPrefs',
  'account:github',
  'account:githubConnect',
  'account:githubRepos',
  'account:githubInstallations',
  'account:githubDisconnect',
  'account:githubCancel',
  // A imagem vai junto no pedido: copia e mostra no computador de quem está usando.
  'files:copyImage',
  'files:revealImage',
] satisfies (keyof InvokeChannels | keyof SendChannels | keyof SendSyncChannels)[]);

const unavailable = (): string => tr('Indisponível no acesso remoto.', 'Unavailable over remote access.');

// Pedidos com resposta bloqueados e o que a janela recebe no lugar.
const BLOCKED_INVOKE: { [C in keyof InvokeChannels]?: () => Awaited<ReturnType<InvokeChannels[C]>> } = {
  'dialog:pickFolder': () => null,
  'dialog:pickFolders': () => [],
  'dialog:pickCloneParent': () => null,
  // Os clones daqui não são os de lá (e o Clonar do GitHub não aparece na janela remota).
  'git:localClones': () => ({}),
  'popout:payload': () => null,
  'media:get': () => null,
  'media:command': () => undefined,
  'media:volume': () => undefined,
  'providers:clipboardKey': () => null,
  // Copiar e colar pela área de transferência do sistema: a daqui não é a de lá. A janela remota
  // copia entre pastas de lá por files:copyInto.
  'files:copy': () => undefined,
  'files:paste': () => ({ ok: false, error: unavailable() }),
  // Os arquivos soltos e o editor de código são deste computador, não do outro.
  'files:import': () => ({ ok: false, error: unavailable() }),
  'files:editors': () => [],
  // O login de MCP passa: o de lá devolve o link para abrir aqui (ver chats/mcpStatus.ts).
};

const BLOCKED_SEND = new Set<string>([
  'popout:open',
  'canvas:newWindow',
  'cli:ready',
  'files:reveal',
  'files:openFolder',
  'files:view',
  'files:openInBrowser',
  'files:openInEditor',
  'sessions:openRepo',
  'providers:install',
  'providers:add',
  'providers:login',
  'providers:submitKey',
] satisfies (keyof SendChannels)[]);

export function channelPolicy(channel: string): ChannelPolicy {
  // Parear e hospedar são deste computador: um aparelho conectado não pareia outros.
  if (channel.startsWith('remoteAccess:')) return 'blocked';
  if (LOCAL.has(channel)) return 'local';
  if (channel in BLOCKED_INVOKE || BLOCKED_SEND.has(channel)) return 'blocked';
  return 'remote';
}

// O valor que um pedido bloqueado recebe (nulo nos que não têm resposta).
export function blockedReply(channel: string): unknown {
  const fallback = (BLOCKED_INVOKE as Record<string, (() => unknown) | undefined>)[channel];
  return fallback ? fallback() : null;
}
