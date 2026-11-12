import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Unplug } from 'lucide-react'
import { tr } from '../../i18n'
import { Presence } from '../../motion'
import { IS_REMOTE, useRemoteAccess } from '../../remote'
import { ContextMenu, type MenuItem, type MenuState } from '../ContextMenu'

// Computador de casa com aparelhos conectados pelo acesso remoto: quantos, na barra de cima. O
// clique abre a lista para desconectar um ou todos (o pareamento continua; para tirar de vez, é o
// "Remover" das Configurações).
export function RemoteConnections() {
  const state = useRemoteAccess()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const connected = state?.devices.filter((d) => d.connected) ?? []
  if (IS_REMOTE || !connected.length) return null

  const items: MenuItem[] = [
    ...connected.map((d) => ({
      type: 'action' as const,
      label: tr(`Desconectar ${d.name}`, `Disconnect ${d.name}`),
      icon: Unplug,
      onSelect: () => window.api.remoteAccess.disconnect(d.id)
    })),
    ...(connected.length > 1
      ? [
          { type: 'separator' as const },
          { type: 'action' as const, label: tr('Desconectar todos', 'Disconnect all'), icon: Unplug, danger: true, onSelect: () => window.api.remoteAccess.disconnect() }
        ]
      : [])
  ]

  return (
    <>
      <button
        type="button"
        title={connected.map((d) => d.name).join(', ')}
        aria-expanded={!!menu}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4, items })
        }}
        className="no-drag rounded-full border border-remote/40 bg-remote/10 px-2 py-px text-[11px] font-medium tracking-wide text-remote uppercase hover:bg-remote/20"
      >
        {connected.length === 1 ? tr('1 conectado', '1 connected') : tr(`${connected.length} conectados`, `${connected.length} connected`)}
      </button>
      {createPortal(<Presence kind="menu">{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}</Presence>, document.body)}
    </>
  )
}
