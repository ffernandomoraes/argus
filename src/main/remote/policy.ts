import type { InvokeChannels, SendChannels, SendSyncChannels } from '../../shared/ipc'
import { tr } from '../i18n'

// O que acontece com cada canal pedido por uma janela de acesso remoto (a janela, no notebook, que
// mostra o Argus de outro computador):
// - local: este Argus responde, porque é coisa da janela ou da máquina de quem está usando (tema,
//   zoom, copiar e colar, idioma);
// - bloqueado: não faz sentido de longe (seletor de pastas, mascote, ditado, abrir no Finder,
//   área de transferência do outro computador); responde o valor padrão e não sai daqui;
// - o resto vai para o Argus do outro computador.
// O Argus de casa confere a mesma lista e recusa o que não for "remoto", mesmo que peçam.

export type ChannelPolicy = 'local' | 'blocked' | 'remote'

const LOCAL = new Set<string>([
  'theme:set',
  'interface:zoom',
  'clipboard:command',
  'accent:get',
  'language:get',
  'auth:open'
] satisfies (keyof InvokeChannels | keyof SendChannels | keyof SendSyncChannels)[])

const unavailable = (): string => tr('Indisponível no acesso remoto.', 'Unavailable over remote access.')
const authElsewhere = (): string =>
  tr(
    'A autorização abre no navegador do outro computador. Pelo acesso remoto ainda não dá: autorize por lá.',
    'Authorization opens in the other computer’s browser. Not possible over remote access yet: authorize there.'
  )

// Pedidos com resposta bloqueados e o que a janela recebe no lugar.
const BLOCKED_INVOKE: { [C in keyof InvokeChannels]?: () => Awaited<ReturnType<InvokeChannels[C]>> } = {
  'dialog:pickFolder': () => null,
  'dialog:pickFolders': () => [],
  'popout:payload': () => null,
  'mascot:findTarget': () => null,
  'mascot:walk': () => undefined,
  'mascot:homeSpot': () => ({ x: 0, y: 0 }),
  'media:get': () => null,
  'media:command': () => undefined,
  'media:volume': () => undefined,
  'providers:clipboardKey': () => null,
  'files:copy': () => undefined,
  'files:paste': () => ({ ok: false, error: unavailable() }),
  // A autorização abre o navegador: abriria no outro computador, onde não tem ninguém.
  'mcp:authenticate': () => ({ ok: false, error: authElsewhere() }),
  'mcp:account:authenticate': () => ({ ok: false, error: authElsewhere() })
}

const BLOCKED_SEND = new Set<string>([
  'popout:open',
  'canvas:newWindow',
  'mascot:enabled',
  'mascot:typing',
  'mascot:interactive',
  'mascot:drag',
  'mascot:dragEnd',
  'mascot:home',
  'mascot:target',
  'speech:start',
  'speech:stop',
  'speech:audio',
  'speech:openSettings',
  'updates:install',
  'cli:ready',
  'files:reveal',
  'files:openFolder',
  'files:view',
  'files:openInBrowser',
  'sessions:openRepo',
  'providers:install',
  'providers:add',
  'providers:login',
  'providers:submitKey'
] satisfies (keyof SendChannels)[])

export function channelPolicy(channel: string): ChannelPolicy {
  // Parear e hospedar são deste computador: um aparelho conectado não pareia outros.
  if (channel.startsWith('remoteAccess:')) return 'blocked'
  if (LOCAL.has(channel)) return 'local'
  if (channel in BLOCKED_INVOKE || BLOCKED_SEND.has(channel)) return 'blocked'
  return 'remote'
}

// O valor que um pedido bloqueado recebe (nulo nos que não têm resposta).
export function blockedReply(channel: string): unknown {
  const fallback = (BLOCKED_INVOKE as Record<string, (() => unknown) | undefined>)[channel]
  return fallback ? fallback() : null
}
