import type { ConversationSummary, ProjectData } from '../canvas/types'
import { ConversationView } from './ConversationView'
import type { SessionSettings } from './SessionSettings'
import { useDrawerZoom } from './useDrawerZoom'

// Espaço dos botões do sistema no topo da janela, em px de tela.
const TRAFFIC_LIGHTS = 80

// A conversa ocupando uma janela própria do sistema. É o modo "foco": sem canvas em volta,
// com escala própria (⌘+ / ⌘-) e sem o visualizador de código ao lado.
export function ConversationWindow({
  project,
  conversation,
  settings,
  onSettingsChange,
  onClose
}: {
  project: ProjectData
  conversation: ConversationSummary
  settings: SessionSettings
  onSettingsChange: (settings: SessionSettings) => void
  onClose: () => void
}) {
  const zoom = useDrawerZoom()

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-bg">
      <ConversationView
        cwd={project.path}
        project={project.name}
        conversation={conversation}
        settings={settings}
        onSettingsChange={onSettingsChange}
        zoom={zoom}
        headerClassName="drag"
        // Os botões do sistema não acompanham a escala: o recuo volta ao tamanho de tela.
        headerStyle={{ zoom, paddingLeft: TRAFFIC_LIGHTS / zoom }}
        onClose={onClose}
      />
    </div>
  )
}
