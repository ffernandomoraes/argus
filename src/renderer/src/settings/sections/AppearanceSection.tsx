import { Monitor, Moon, Sun } from 'lucide-react'
import { SYSTEM_NAME } from '../../platform'
import type { ThemePreference } from '../../theme/useTheme'
import { INTERFACE_ZOOMS } from '../../../../shared/interfaceZoom'
import { Group, Row, Segmented, Select } from '../controls'
import { setPreferences, usePreference } from '../preferences'
import { tr } from '../../i18n'

export function AppearanceSection({ theme, onThemeChange }: { theme: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  const zoom = usePreference('interfaceZoom')
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
      <Row
        label={tr('Tamanho da interface', 'Interface size')}
        description={tr(
          'Aumenta ou diminui a janela inteira, para monitores maiores ou menores. O zoom do canvas e da conversa continua valendo por cima.',
          'Scales the whole window up or down for larger or smaller displays. Canvas and conversation zoom still apply on top.'
        )}
      >
        <Select value={String(zoom)} onChange={(v) => setPreferences({ interfaceZoom: Number(v) })} label={tr('Tamanho da interface', 'Interface size')}>
          {INTERFACE_ZOOMS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%{z === 1 ? tr(' (padrão)', ' (default)') : ''}
            </option>
          ))}
        </Select>
      </Row>
    </Group>
  )
}
