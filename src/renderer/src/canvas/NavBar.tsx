import { memo } from 'react'
import { Panel } from '@xyflow/react'
import { Bot, Brain, Server, Settings } from 'lucide-react'
import { IS_WIN } from '../platform'
import { NavButton } from '../ui/NavButton'
import { NewBlockMenu } from './bars/NewBlockMenu'
import { useCanvasActions } from './CanvasContext'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { tr } from '../i18n'

const Divider = () => <span className="my-1.5 h-px w-5 bg-line" />

export const NavBar = memo(function NavBar({ zoomShortcuts = true }: { zoomShortcuts?: boolean }) {
  const { openSettings, openMemory, openAgents, openDevServers } = useCanvasActions()
  useCanvasShortcuts(zoomShortcuts)

  return (
    // Na lateral esquerda, no meio da altura: embaixo ela disputava espaço com o drawer aberto.
    // Grupo de botões: raio do contêiner = raio do botão (md) + o respiro (p-1), para os cantos acompanharem.
    <Panel position="center-left" className="!ml-4">
      <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface/90 p-1 shadow-xl shadow-black/40 backdrop-blur-xl">
        <NewBlockMenu />

        <Divider />

        <NavButton label={tr('Agentes', 'Agents')} onClick={openAgents}>
          <Bot size={16} />
        </NavButton>
        {/* No Windows não dá para saber quais servidores um agente abriu (ver devServers.ts). */}
        {!IS_WIN && (
          <NavButton label={tr('Servidores rodando', 'Running servers')} onClick={openDevServers}>
            <Server size={16} />
          </NavButton>
        )}
        <NavButton label={tr('Memória do Claude', 'Claude memory')} onClick={() => openMemory()}>
          <Brain size={16} />
        </NavButton>

        <Divider />

        <NavButton label={tr('Configurações', 'Settings')} shortcut="⌘ ," onClick={openSettings}>
          <Settings size={16} />
        </NavButton>
      </div>
    </Panel>
  )
})
