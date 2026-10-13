import { useEffect, useState } from 'react'
import { IS_LINUX, IS_WIN } from '../../platform'
import { Row, Switch } from '../controls'

// Na barra de menus do Mac; no Windows, na área de notificação, perto do relógio; no Linux, na
// bandeja do sistema (o GNOME só mostra com a extensão AppIndicator, que o Ubuntu já traz).
const TRAY = IS_WIN
  ? { label: 'Ícone na área de notificação', where: 'perto do relógio do Windows' }
  : IS_LINUX
    ? { label: 'Ícone na bandeja do sistema', where: 'no topo da tela (no GNOME, precisa da extensão AppIndicator)' }
    : { label: 'Ícone na barra de menus', where: 'no topo do macOS' }

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
    <Row label={TRAY.label} description={`Mostra ${TRAY.where} quando uma conversa está rodando, precisa de você ou terminou.`}>
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
