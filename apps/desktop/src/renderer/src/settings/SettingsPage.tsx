import { useState } from 'react';
import type { ThemePreference } from '../theme/useTheme';
import { ModalCloseButton } from '../ui/ModalCloseButton';
import { AccountNavRow } from './AccountNavRow';
import { AccountsSection } from './sections/AccountsSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { CoffeeSection } from './sections/CoffeeSection';
import { ConversationsSection } from './sections/ConversationsSection';
import { GeneralSection } from './sections/GeneralSection';
import { McpSection } from './sections/McpSection';
import { RemoteAccessSection } from './sections/RemoteAccessSection';
import { IS_REMOTE } from '../remote';
import { NotificationsSection } from './sections/NotificationsSection';
import { ProfileSection } from './sections/ProfileSection';
import { StorageSection } from './sections/StorageSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { SECTION_GROUPS, SECTIONS, type Section } from './sections/sectionList';
import { tr } from '../i18n';
import { ButtonSizeContext } from '../ui/buttonSizeContext';

// Conteúdo do painel de configurações: seções à esquerda, opções à direita.
export function SettingsPage({
  theme,
  onThemeChange,
}: {
  theme: ThemePreference
  onThemeChange: (t: ThemePreference) => void
}) {
  const [section, setSection] = useState<Section>('general');
  // Acesso remoto e a conta do Argus ficam fora da janela remota: são da máquina de quem está usando.
  const sections = SECTIONS.filter((s) => (s.id !== 'remote' && s.id !== 'profile') || !IS_REMOTE);

  const navItem = (s: (typeof SECTIONS)[number]) => {
    const Icon = s.icon;
    const selected = section === s.id;
    return (
      <button
        key={s.id}
        onClick={() => setSection(s.id)}
        aria-current={selected ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-md px-3 py-1 text-left text-[16px] ${
          selected ? 'bg-selection text-white' : 'text-muted hover:bg-fill hover:text-text'
        }`}
      >
        <Icon size={15} className="shrink-0" />
        <span className="flex-1">{s.label}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full">
      {/* Lateral um tom abaixo do conteúdo, como a do Ajustes do Sistema. */}
      <nav className="flex w-72 shrink-0 flex-col border-r border-line bg-bg">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <div className="mb-3 px-3 pt-1 text-[16px] font-semibold">{tr('Configurações', 'Settings')}</div>
          {!IS_REMOTE && <AccountNavRow selected={section === 'profile'} onSelect={() => setSection('profile')} />}
          {SECTION_GROUPS.map((g) => {
            const items = sections.filter((s) => s.group === g.id);
            if (items.length === 0) return null;
            return (
              <div key={g.id} className="mb-6 flex flex-col gap-0.5">
                {/* Título do grupo, apagado como o "Favoritos" da lateral do Finder. */}
                <div className="px-3 pb-1 text-[12px] uppercase tracking-widest text-faint">{g.label}</div>
                {items.map(navItem)}
              </div>
            );
          })}
          {/* Pé da lateral: o café, fora dos grupos. */}
          <div className="mt-auto flex flex-col gap-0.5">{sections.filter((s) => s.group === 'footer').map(navItem)}</div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        {/* O X fica fora da área que rola, para continuar à vista com a seção rolada. */}
        <div className="relative min-h-0 flex-1">
          <ModalCloseButton variant="subtle" className="absolute right-3 top-3 z-10" />
          {/* Topo maior que os lados: o conteúdo começa abaixo do X. */}
          <section className="h-full overflow-y-auto px-10 pb-10 pt-14">
            {/* Coluna com largura de leitura: na tela cheia, as linhas não esticam até a borda. */}
            {/* Os botões daqui têm a medida dos campos (36 px, letra de 15 px). */}
            <ButtonSizeContext value="field">
            <div className="mx-auto max-w-[860px]">
              {section === 'profile' && <ProfileSection />}
              {section === 'general' && <GeneralSection />}
              {section === 'conversations' && <ConversationsSection />}
              {section === 'notifications' && <NotificationsSection />}
              {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
              {section === 'updates' && <UpdatesSection />}
              {section === 'storage' && <StorageSection />}
              {section === 'accounts' && <AccountsSection />}
              {section === 'mcp' && <McpSection />}
              {section === 'remote' && <RemoteAccessSection />}
              {section === 'coffee' && <CoffeeSection />}
            </div>
            </ButtonSizeContext>
          </section>
        </div>
      </div>
    </div>
  );
}
