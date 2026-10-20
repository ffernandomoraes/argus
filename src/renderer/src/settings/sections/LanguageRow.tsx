import { useEffect, useState } from 'react'
import type { LangPreference } from '../../../../shared/i18n'
import { tr } from '../../i18n'
import { Row, Segmented } from '../controls'

// Guardada no processo principal: o menu e as notificações também usam. Ao trocar, as janelas
// recarregam com os textos novos (ver main.tsx).
export function LanguageRow() {
  const [pref, setPref] = useState<LangPreference | null>(null)
  useEffect(() => {
    let alive = true
    window.api.settings.get().then(
      (s) => alive && setPref(s.language),
      (err: unknown) => console.error('[configurações] idioma:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <Row below label={tr('Idioma', 'Language')} description={tr('Sistema usa o idioma do computador.', 'System follows the computer language.')}>
      {pref !== null && (
        <Segmented
          value={pref}
          onChange={(next) => {
            setPref(next)
            void window.api.settings.setLanguage(next)
          }}
          // O nome de cada idioma escrito nele mesmo, para achar mesmo sem entender o outro.
          options={[
            { value: 'pt', label: 'Português' },
            { value: 'en', label: 'English' },
            { value: 'system', label: tr('Sistema', 'System') }
          ]}
        />
      )}
    </Row>
  )
}
