import { useEffect, useState } from 'react'
import { IS_WIN } from '../../platform'
import { Row, Switch } from '../controls'

// Na barra de menus do Mac; no Windows, na área de notificação, perto do relógio.
const TRAY = IS_WIN
  ? { label: 'Ícone na área de notificação', where: 'perto do relógio do Windows' }
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
