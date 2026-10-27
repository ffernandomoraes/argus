import { useEffect, useState } from 'react'
import { Group, Row, Switch } from '../controls'
import { tr } from '../../i18n'

const LABEL = tr('Notificações do sistema', 'System notifications')
const SOUND = tr('Som das notificações', 'Notification sound')

// Guardadas no processo principal: é ele que mostra as notificações. O som só aparece com as
// notificações ligadas.
export function NotificationsSection() {
  const [settings, setSettings] = useState<{ on: boolean; sound: boolean } | null>(null)
  useEffect(() => {
    let alive = true
    window.api.settings.get().then(
      (s) => alive && setSettings({ on: s.notifications, sound: s.notificationSound }),
      (err: unknown) => console.error('[configurações] notificações:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  if (!settings) return null
  return (
    <Group>
      <Row label={LABEL} description={tr(
          'Avisa quando uma conversa precisa de você, termina ou para com erro, com o app fora de foco.',
          'Alerts when a chat needs you, is done or stops with an error, while the app is out of focus.'
        )}>
        <Switch
          label={LABEL}
          checked={settings.on}
          onChange={(next) => {
            setSettings({ ...settings, on: next })
            void window.api.settings.setNotifications(next)
          }}
        />
      </Row>
      {settings.on && (
        <Row label={SOUND} description={tr(
            'Toca o som do sistema junto com a notificação.',
            'Plays the system sound along with the notification.'
          )}>
          <Switch
            label={SOUND}
            checked={settings.sound}
            onChange={(next) => {
              setSettings({ ...settings, sound: next })
              void window.api.settings.setNotificationSound(next)
            }}
          />
        </Row>
      )}
    </Group>
  )
}
