import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ThemePreference } from '../theme/useTheme'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { ExperimentTag } from '../ui/ExperimentTag'
import { setPreferences, usePreference } from './preferences'
import { AccountsSection } from './sections/AccountsSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { CoffeeSection } from './sections/CoffeeSection'
import { ConversationsSection } from './sections/ConversationsSection'
import { ExperimentsSection } from './sections/ExperimentsSection'
import { GeneralSection } from './sections/GeneralSection'
import { OrchestratorSection } from './sections/OrchestratorSection'
import { SECTIONS, type Section } from './sections/sectionList'
import { tr } from '../i18n'

// Conteúdo do modal de configurações: seções à esquerda, opções à direita.
export function SettingsPage({
  theme,
  onThemeChange,
  onClose
}: {
  theme: ThemePreference
  onThemeChange: (t: ThemePreference) => void
  onClose: () => void
}) {
  const [section, setSection] = useState<Section>('general')
  // Seção de experimento só aparece com ele ligado em Experimentos.
  const orchestrator = usePreference('orchestratorEnabled')
  const sections = SECTIONS.filter((s) => s.id !== 'orchestrator' || orchestrator)
  const current = SECTIONS.find((s) => s.id === section)!
  const CurrentIcon = current.icon

  return (
    <div className="flex h-full">
      {/* Lateral um tom abaixo do conteúdo, como a do Ajustes do Sistema. */}
      <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-bg p-3">
        <div className="mb-3 px-2 pt-1 text-[13px] font-semibold">{tr('Configurações', 'Settings')}</div>
        {sections.map((s) => {
          const Icon = s.icon
          const selected = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={selected ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] ${
                selected ? 'bg-selection text-white' : 'text-muted hover:bg-fill hover:text-text'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="flex-1">{s.label}</span>
              {s.experimental && <ExperimentTag />}
            </button>
          )
        })}
        {/* Não é uma seção: fecha as configurações e abre o passo a passo das boas-vindas. Fica no pé da lateral. */}
        <button
          onClick={() => {
            onClose()
            setPreferences({ welcomeSeen: false })
          }}
          className="mt-auto flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-muted hover:bg-fill hover:text-text"
        >
          <Sparkles size={15} />
          {tr('Boas-vindas', 'Welcome')}
        </button>
      </nav>

      <section className="relative min-w-0 flex-1 overflow-y-auto bg-surface">
        <ModalCloseButton variant="subtle" className="absolute right-3 top-3 z-10" />
        <div className="px-8 py-7">
          {/* Cabeçalho da seção, como o do Ajustes do Sistema: ícone grande, nome e o que tem nela. */}
          <header className="mb-4 flex flex-col items-center rounded-xl bg-fill px-6 py-5 text-center">
            <CurrentIcon size={28} className="text-muted" />
            <h1 className="mt-2.5 flex items-center gap-2 text-lg font-bold">
              {current.label}
              {current.experimental && <ExperimentTag />}
            </h1>
            <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-muted">{current.description}</p>
          </header>
          {section === 'general' && <GeneralSection />}
          {section === 'conversations' && <ConversationsSection />}
          {section === 'orchestrator' && <OrchestratorSection />}
          {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
          {section === 'accounts' && <AccountsSection />}
          {section === 'experiments' && <ExperimentsSection />}
          {section === 'coffee' && <CoffeeSection />}
        </div>
      </section>
    </div>
  )
}
