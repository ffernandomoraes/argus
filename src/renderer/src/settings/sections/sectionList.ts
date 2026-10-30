import { Bell, Coffee, FlaskConical, HardDrive, MessagesSquare, Network, Palette, PersonStanding, Plug, RefreshCw, Settings2, Users } from 'lucide-react'
import { tr } from '../../i18n'

export type Section =
  | 'general'
  | 'conversations'
  | 'notifications'
  | 'orchestrator'
  | 'appearance'
  | 'updates'
  | 'storage'
  | 'mascot'
  | 'accounts'
  | 'mcp'
  | 'experiments'
  | 'coffee'

export type SectionGroup = 'app' | 'agents' | 'extras' | 'footer'

// Grupos da lateral, na ordem em que aparecem, com o título em cima de cada um. O 'footer' não
// tem título: vai para o pé da lateral.
export const SECTION_GROUPS: { id: Exclude<SectionGroup, 'footer'>; label: string }[] = [
  { id: 'app', label: tr('Preferências', 'Preferences') },
  { id: 'agents', label: tr('Conexões', 'Connections') },
  { id: 'extras', label: tr('Extras', 'Extras') }
]

// Cada seção com o ícone e a frase do cabeçalho dela. Ícone solto, sem quadradinho: com fundo
// ficou carregado demais.
// experimental: ligada em Experimentos; leva o selo na frente do nome.
export const SECTIONS: {
  id: Section
  group: SectionGroup
  label: string
  icon: typeof Settings2
  description: string
  experimental?: boolean
}[] = [
  {
    id: 'general',
    group: 'app',
    label: tr('Geral', 'General'),
    icon: Settings2,
    description: tr(
      'Idioma, onde as conversas abrem, o player de música e o comando no terminal.',
      'Language, where chats open, the music player and the terminal command.'
    )
  },
  {
    id: 'conversations',
    group: 'app',
    label: tr('Conversas', 'Chats'),
    icon: MessagesSquare,
    description: tr(
      'Como cada conversa abre. O que você troca no próprio chat vale só para aquela conversa.',
      'How each chat opens. What you change in the chat itself applies only to that chat.'
    )
  },
  {
    id: 'notifications',
    group: 'app',
    label: tr('Notificações', 'Notifications'),
    icon: Bell,
    description: tr(
      'Os avisos do sistema quando uma conversa precisa de você, termina ou para com erro.',
      'System alerts when a chat needs you, is done or stops with an error.'
    )
  },
  {
    id: 'appearance',
    group: 'app',
    label: tr('Aparência', 'Appearance'),
    icon: Palette,
    description: tr('Tema claro, escuro ou o mesmo do sistema.', 'Light, dark or the same as the system.')
  },
  {
    id: 'updates',
    group: 'app',
    label: tr('Atualizações', 'Updates'),
    icon: RefreshCw,
    description: tr('As versões do Argus e do Claude Code, e o que mudou em cada uma.', 'The Argus and Claude Code versions, and what changed in each.')
  },
  {
    id: 'storage',
    group: 'app',
    label: tr('Armazenamento', 'Storage'),
    icon: HardDrive,
    description: tr(
      'O espaço que as conversas e os rascunhos do agente ocupam, e a limpeza automática deles.',
      'The space chats and the agent’s scratch files take up, and their automatic cleanup.'
    )
  },
  {
    id: 'accounts',
    group: 'agents',
    label: tr('Contas', 'Accounts'),
    icon: Users,
    description: tr('As contas do Claude Code que o Argus usa.', 'The Claude Code accounts Argus uses.')
  },
  {
    id: 'mcp',
    group: 'agents',
    label: 'MCP',
    icon: Plug,
    description: tr(
      'Os servidores MCP de cada conta: autorize, reconecte ou desconecte sem abrir uma conversa.',
      'Each account’s MCP servers: authorize, reconnect or sign out without opening a chat.'
    )
  },
  {
    id: 'orchestrator',
    group: 'agents',
    label: tr('Orquestrador', 'Orchestrator'),
    icon: Network,
    experimental: true,
    description: tr(
      'Ligado numa conversa, não executa: divide o pedido em etapas e manda cada uma ao modelo e esforço que ela pede.',
      'When on in a chat, it doesn’t do the work: splits the request into steps and sends each to the model and effort it needs.'
    )
  },
  {
    id: 'mascot',
    group: 'extras',
    label: tr('Mascote', 'Mascot'),
    icon: PersonStanding,
    experimental: true,
    description: tr(
      'Monte o bonequinho solto na tela: corpo, pele, rosto, olhos, boca, cabelo, barba e o golpe que ele dá no envio.',
      'Build the little character loose on your screen: body, skin, face, eyes, mouth, hair, beard and the strike it gives on send.'
    )
  },
  {
    id: 'experiments',
    group: 'extras',
    label: tr('Experimentos', 'Experiments'),
    icon: FlaskConical,
    description: tr(
      'Recursos em teste ou só por diversão. Vêm desligados; ligue o que quiser experimentar.',
      'Features being tested or just for fun. They start off; turn on what you want to try.'
    )
  },
  {
    id: 'coffee',
    group: 'footer',
    label: tr('Me pague um café', 'Buy me a coffee'),
    icon: Coffee,
    description: tr(
      'Se o Argus te ajuda no dia a dia, um Pix de qualquer valor ajuda a manter o projeto.',
      'If Argus helps you every day, a Pix of any amount helps keep the project going.'
    )
  }
]
