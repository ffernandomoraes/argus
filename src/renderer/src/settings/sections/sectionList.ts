import { Coffee, MessagesSquare, Palette, Settings2, Users } from 'lucide-react'

export type Section = 'general' | 'conversations' | 'appearance' | 'accounts' | 'coffee'

// Cada seção com o ícone e a frase do cabeçalho dela. Ícone solto, sem quadradinho: com fundo
// ficou carregado demais.
export const SECTIONS: { id: Section; label: string; icon: typeof Settings2; description: string }[] = [
  {
    id: 'general',
    label: 'Geral',
    icon: Settings2,
    description: 'Onde as conversas abrem, o ícone do sistema, o comando no terminal e as atualizações.'
  },
  {
    id: 'conversations',
    label: 'Conversas',
    icon: MessagesSquare,
    description: 'Como cada conversa abre. O que você troca no próprio chat vale só para aquela conversa.'
  },
  { id: 'appearance', label: 'Aparência', icon: Palette, description: 'Tema claro, escuro ou o mesmo do sistema.' },
  { id: 'accounts', label: 'Contas', icon: Users, description: 'As contas do Claude Code que o Argus usa.' },
  {
    id: 'coffee',
    label: 'Me pague um café',
    icon: Coffee,
    description: 'Se o Argus te ajuda no dia a dia, um Pix de qualquer valor ajuda a manter o projeto.'
  }
]
