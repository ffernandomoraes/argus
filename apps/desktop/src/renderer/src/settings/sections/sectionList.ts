import { Bell, Coffee, Globe, HardDrive, MessagesSquare, Palette, Plug, RefreshCw, Settings2, UserRound, Users } from 'lucide-react';
import { tr } from '../../i18n';

export type Section =
  | 'profile'
  | 'general'
  | 'conversations'
  | 'notifications'
  | 'appearance'
  | 'updates'
  | 'storage'
  | 'accounts'
  | 'mcp'
  | 'remote'
  | 'coffee';

// 'account': a linha da conta do Argus no topo da lateral (AccountNavRow), fora dos grupos.
export type SectionGroup = 'account' | 'app' | 'agents' | 'footer';

// Grupos da lateral, na ordem em que aparecem, com o título em cima de cada um. O 'footer' não
// tem título: vai para o pé da lateral.
export const SECTION_GROUPS: { id: Exclude<SectionGroup, 'footer' | 'account'>; label: string }[] = [
  { id: 'app', label: tr('Preferências', 'Preferences') },
  { id: 'agents', label: tr('Conexões', 'Connections') },
];

// Cada seção com o ícone da lateral. Ícone solto, sem quadradinho: com fundo
// ficou carregado demais.
export const SECTIONS: {
  id: Section
  group: SectionGroup
  label: string
  icon: typeof Settings2
}[] = [
  {
    id: 'profile',
    group: 'account',
    label: tr('Perfil', 'Profile'),
    icon: UserRound,
  },
  {
    id: 'general',
    group: 'app',
    label: tr('Geral', 'General'),
    icon: Settings2,
  },
  {
    id: 'conversations',
    group: 'app',
    label: tr('Conversas', 'Chats'),
    icon: MessagesSquare,
  },
  {
    id: 'notifications',
    group: 'app',
    label: tr('Notificações', 'Notifications'),
    icon: Bell,
  },
  {
    id: 'appearance',
    group: 'app',
    label: tr('Aparência', 'Appearance'),
    icon: Palette,
  },
  {
    id: 'updates',
    group: 'app',
    label: tr('Atualizações', 'Updates'),
    icon: RefreshCw,
  },
  {
    id: 'storage',
    group: 'app',
    label: tr('Armazenamento', 'Storage'),
    icon: HardDrive,
  },
  {
    id: 'accounts',
    group: 'agents',
    label: tr('Contas', 'Accounts'),
    icon: Users,
  },
  {
    id: 'mcp',
    group: 'agents',
    label: 'MCP',
    icon: Plug,
  },
  {
    id: 'remote',
    group: 'agents',
    label: tr('Acesso remoto', 'Remote access'),
    icon: Globe,
  },
  {
    id: 'coffee',
    group: 'footer',
    label: tr('Me pague um café', 'Buy me a coffee'),
    icon: Coffee,
  },
];
