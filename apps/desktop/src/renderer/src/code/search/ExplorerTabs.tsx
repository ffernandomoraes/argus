import type { ReactNode } from 'react';
import { Files, Search } from 'lucide-react';
import { tr } from '../../i18n';
import { keys } from '../../platform';
import { IconButton } from '../../ui/IconButton';
import type { ExplorerTab } from './searchState';

const TABS: { value: ExplorerTab; label: string; shortcut: string; icon: ReactNode }[] = [
  { value: 'files', label: tr('Arquivos', 'Files'), shortcut: '⌘P', icon: <Files size={14} /> },
  { value: 'search', label: tr('Buscar', 'Search'), shortcut: '⇧⌘F', icon: <Search size={14} /> },
];

// Barra de ícones do alto do painel de código: à esquerda, árvore ou busca no conteúdo; à direita,
// os botões da aba (criar arquivo e pasta, atualizar).
export function ExplorerTabs({ tab, onChange, children }: { tab: ExplorerTab; onChange: (tab: ExplorerTab) => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5">
      {TABS.map((t) => (
        <IconButton key={t.value} label={`${t.label} (${keys(t.shortcut)})`} pressed={tab === t.value} onClick={() => onChange(t.value)}>
          {t.icon}
        </IconButton>
      ))}
      <span className="flex-1" />
      {children}
    </div>
  );
}
