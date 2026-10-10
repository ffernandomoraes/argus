import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { ThemePreference } from '../theme/useTheme'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { setPreferences } from './preferences'
import { AccountsSection } from './sections/AccountsSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { CoffeeSection } from './sections/CoffeeSection'
import { ConversationsSection } from './sections/ConversationsSection'
import { GeneralSection } from './sections/GeneralSection'
import { SECTIONS, type Section } from './sections/sectionList'

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
  const current = SECTIONS.find((s) => s.id === section)!
  const CurrentIcon = current.icon

  return (
    <div className="flex h-full">
      {/* Lateral um tom abaixo do conteúdo, como a do Ajustes do Sistema. */}
      <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-bg p-3">
        <div className="mb-3 px-2 pt-1 text-[13px] font-semibold">Configurações</div>
        {SECTIONS.map((s) => {
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
              <Icon size={15} />
              {s.label}
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
          Boas-vindas
        </button>
      </nav>

      <section className="relative min-w-0 flex-1 overflow-y-auto bg-surface">
        <ModalCloseButton variant="subtle" className="absolute right-3 top-3 z-10" />
        <div className="px-8 py-7">
          {/* Cabeçalho da seção, como o do Ajustes do Sistema: ícone grande, nome e o que tem nela. */}
          <header className="mb-4 flex flex-col items-center rounded-xl bg-fill px-6 py-5 text-center">
            <CurrentIcon size={28} strokeWidth={1.75} className="text-muted" />
            <h1 className="mt-2.5 text-lg font-bold">{current.label}</h1>
            <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-muted">{current.description}</p>
          </header>
          {section === 'general' && <GeneralSection />}
          {section === 'conversations' && <ConversationsSection />}
          {section === 'appearance' && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
          {section === 'accounts' && <AccountsSection />}
          {section === 'coffee' && <CoffeeSection />}
        </div>
      </section>
    </div>
  )
}
