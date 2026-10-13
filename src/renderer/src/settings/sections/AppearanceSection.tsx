import { Monitor, Moon, Sun } from 'lucide-react'
import { SYSTEM_NAME } from '../../platform'
import type { ThemePreference } from '../../theme/useTheme'
import { Group, Row, Segmented } from '../controls'
import { tr } from '../../i18n'

export function AppearanceSection({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  return (
    <Group>
      <Row
        label={tr('Tema', 'Theme')}
        description={tr(`Sistema acompanha o modo claro ou escuro do ${SYSTEM_NAME}.`, `System follows the light or dark mode of ${SYSTEM_NAME}.`)}
      >
        <Segmented
          value={theme}
          onChange={onThemeChange}
          options={[
            { value: 'dark', label: tr('Escuro', 'Dark'), icon: <Moon size={13} /> },
            { value: 'light', label: tr('Claro', 'Light'), icon: <Sun size={13} /> },
            { value: 'system', label: tr('Sistema', 'System'), icon: <Monitor size={13} /> }
          ]}
        />
      </Row>
    </Group>
  )
}
