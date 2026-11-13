import { useEffect, useState } from 'react'
import { IS_LINUX, IS_WIN } from '../../platform'
import { Row, Switch } from '../controls'
import { tr } from '../../i18n'

// Na barra de menus do Mac; no Windows, na área de notificação, perto do relógio; no Linux, na
// bandeja do sistema (o GNOME só mostra com a extensão AppIndicator, que o Ubuntu já traz).
const TRAY = IS_WIN
  ? { label: tr('Ícone na área de notificação', 'Notification area icon'), where: tr('perto do relógio do Windows', 'near the Windows clock') }
  : IS_LINUX
    ? {
        label: tr('Ícone na bandeja do sistema', 'System tray icon'),
        where: tr('no topo da tela (no GNOME, precisa da extensão AppIndicator)', 'at the top of the screen (on GNOME, needs the AppIndicator extension)')
      }
    : { label: tr('Ícone na barra de menus', 'Menu bar icon'), where: tr('no topo do macOS', 'at the top of macOS') }

// Guardada no processo principal: o ícone é criado antes de a janela abrir.
export function MenuBarIconRow() {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    window.api.settings.get().then(
      (s) => alive && setOn(s.menuBarIcon),
      (err: unknown) => console.error('[configurações] ícone do sistema:', err)
    )
    return () => {
      alive = false
    }
  }, [])

  return (
    <Row label={TRAY.label} description={tr(
        `Mostra ${TRAY.where} quando uma conversa está rodando, precisa de você ou terminou.`,
        `Shows ${TRAY.where} when a chat is running, needs you or is done.`
      )}>
      {on !== null && (
        <Switch
          label={TRAY.label}
          checked={on}
          onChange={(next) => {
            setOn(next)
            void window.api.settings.setMenuBarIcon(next)
          }}
        />
      )}
    </Row>
  )
}
