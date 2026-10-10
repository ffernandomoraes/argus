import { Monitor, Moon, Sun } from 'lucide-react'
import { SYSTEM_NAME } from '../../platform'
import type { ThemePreference } from '../../theme/useTheme'
import { Group, Row, Segmented } from '../controls'

export function AppearanceSection({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  return (
    <Group>
      <Row label="Tema" description={`Sistema acompanha o modo claro ou escuro do ${SYSTEM_NAME}.`}>
        <Segmented
          value={theme}
          onChange={onThemeChange}
          options={[
            { value: 'dark', label: 'Escuro', icon: <Moon size={13} /> },
            { value: 'light', label: 'Claro', icon: <Sun size={13} /> },
            { value: 'system', label: 'Sistema', icon: <Monitor size={13} /> }
          ]}
        />
      </Row>
    </Group>
  )
}
