import { Coffee, FlaskConical, MessagesSquare, Palette, Settings2, Users } from 'lucide-react'
import { tr } from '../../i18n'

export type Section = 'general' | 'conversations' | 'appearance' | 'accounts' | 'experiments' | 'coffee'

// Cada seção com o ícone e a frase do cabeçalho dela. Ícone solto, sem quadradinho: com fundo
// ficou carregado demais.
export const SECTIONS: { id: Section; label: string; icon: typeof Settings2; description: string }[] = [
  {
    id: 'general',
    label: tr('Geral', 'General'),
    icon: Settings2,
    description: tr(
      'Onde as conversas abrem, o ícone do sistema, o comando no terminal e as atualizações.',
      'Where chats open, the system icon, the terminal command and updates.'
    )
  },
  {
    id: 'conversations',
    label: tr('Conversas', 'Chats'),
    icon: MessagesSquare,
    description: tr(
      'Como cada conversa abre. O que você troca no próprio chat vale só para aquela conversa.',
      'How each chat opens. What you change in the chat itself applies only to that chat.'
    )
  },
  {
    id: 'appearance',
    label: tr('Aparência', 'Appearance'),
    icon: Palette,
    description: tr('Tema claro, escuro ou o mesmo do sistema.', 'Light, dark or the same as the system.')
  },
  {
    id: 'accounts',
    label: tr('Contas', 'Accounts'),
    icon: Users,
    description: tr('As contas do Claude Code que o Argus usa.', 'The Claude Code accounts Argus uses.')
  },
  {
    id: 'experiments',
    label: tr('Experimentos', 'Experiments'),
    icon: FlaskConical,
    description: tr(
      'Recursos em teste ou só por diversão. Vêm desligados; ligue o que quiser experimentar.',
      'Features being tested or just for fun. They start off; turn on what you want to try.'
    )
  },
  {
    id: 'coffee',
    label: tr('Me pague um café', 'Buy me a coffee'),
    icon: Coffee,
    description: tr(
      'Se o Argus te ajuda no dia a dia, um Pix de qualquer valor ajuda a manter o projeto.',
      'If Argus helps you every day, a Pix of any amount helps keep the project going.'
    )
  }
]
