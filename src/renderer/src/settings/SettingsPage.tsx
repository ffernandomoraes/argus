import { useState } from 'react'
import type { ThemePreference } from '../theme/useTheme'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { ExperimentTag } from '../ui/ExperimentTag'
import { usePreference } from './preferences'
import { AccountsSection } from './sections/AccountsSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { CoffeeSection } from './sections/CoffeeSection'
import { ConversationsSection } from './sections/ConversationsSection'
import { ExperimentsSection } from './sections/ExperimentsSection'
import { GeneralSection } from './sections/GeneralSection'
import { MascotSection } from './sections/MascotSection'
import { McpSection } from './sections/McpSection'
import { NotificationsSection } from './sections/NotificationsSection'
import { OrchestratorSection } from './sections/OrchestratorSection'
import { UpdatesSection } from './sections/UpdatesSection'
import { SECTION_GROUPS, SECTIONS, type Section } from './sections/sectionList'
import { tr } from '../i18n'

// Conteúdo do modal de configurações: seções à esquerda, opções à direita.
export function SettingsPage({
  theme,
  onThemeChange
}: {
  theme: ThemePreference
  onThemeChange: (t: ThemePreference) => void
}) {
  const [section, setSection] = useState<Section>('general')
  // Seção de experimento só aparece com ele ligado em Experimentos.
  const orchestrator = usePreference('orchestratorEnabled')
  const mascot = usePreference('mascot')
  const sections = SECTIONS.filter((s) => (s.id !== 'orchestrator' || orchestrator) && (s.id !== 'mascot' || mascot))
  const current = SECTIONS.find((s) => s.id === section)!
  const CurrentIcon = current.icon

  const navItem = (s: (typeof SECTIONS)[number]) => {
    const Icon = s.icon
    const selected = section === s.id
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
        {s.experimental && <ExperimentTag />}
      </button>
    )
  }

  return (
    <div className="flex h-full">
      {/* Lateral um tom abaixo do conteúdo, como a do Ajustes do Sistema. */}
      <nav className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-bg p-3">
        <div className="mb-3 px-3 pt-1 text-[16px] font-semibold">{tr('Configurações', 'Settings')}</div>
        {SECTION_GROUPS.map((g) => {
          const items = sections.filter((s) => s.group === g.id)
          if (items.length === 0) return null
          return (
            <div key={g.id} className="mb-3 flex flex-col gap-0.5">
              {/* Título do grupo, apagado como o "Favoritos" da lateral do Finder. */}
              <div className="px-3 pb-1 text-[12px] uppercase tracking-widest text-faint">{g.label}</div>
              {items.map(navItem)}
            </div>
          )
        })}
        {/* Pé da lateral: o café, fora dos grupos. */}
        <div className="mt-auto flex flex-col gap-0.5">{sections.filter((s) => s.group === 'footer').map(navItem)}</div>
      </nav>

      {/* O X fica fora da área que rola, para continuar à vista com a seção rolada. */}
      <div className="relative min-w-0 flex-1 bg-surface">
        <ModalCloseButton variant="subtle" className="absolute right-3 top-3 z-10" />
        {/* Topo maior que os lados: o conteúdo começa abaixo do X, que antes ficava em cima do cartão. */}
        <section className="h-full overflow-y-auto px-8 pb-7 pt-14">
          {/* Cabeçalho da seção, como o do Ajustes do Sistema: ícone grande, nome e o que tem nela. */}
          <header className="mb-4 flex flex-col items-center rounded-xl bg-fill px-6 py-5 text-center">
            <CurrentIcon size={28} className="text-muted" />
            <h1 className="mt-2.5 flex items-center gap-2 text-lg font-bold">
              {current.label}
              {current.experimental && <ExperimentTag />}
            </h1>
            <p className="mt-0.5 max-w-md text-balance text-[15px] leading-relaxed text-muted">{current.description}</p>
          </header>
          {section === 'general' && <GeneralSection />}
          {section === 'conversations' && <ConversationsSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'orchestrator' && <OrchestratorSection />}
          {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
          {section === 'updates' && <UpdatesSection />}
          {section === 'mascot' && <MascotSection />}
          {section === 'accounts' && <AccountsSection />}
          {section === 'mcp' && <McpSection />}
          {section === 'experiments' && <ExperimentsSection />}
          {section === 'coffee' && <CoffeeSection />}
        </section>
      </div>
    </div>
  )
}
