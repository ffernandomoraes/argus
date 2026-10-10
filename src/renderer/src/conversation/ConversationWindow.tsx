import { useMemo } from 'react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useWindowControls } from '../useWindowControls'
import { ConversationView } from './ConversationView'
import { useDrawerZoom } from './useDrawerZoom'

// A conversa ocupando uma janela própria do sistema. É o modo "foco": sem canvas em volta,
// com escala própria (⌘+ / ⌘-) e sem o visualizador de código ao lado.
export function ConversationWindow({
  project,
  account,
  conversation,
  onClose
}: {
  project: ProjectData
  // Conta do Claude do grupo da pasta; vazia = a padrão.
  account?: string
  conversation: ConversationSummary
  onClose: () => void
}) {
  const zoom = useDrawerZoom()
  const controls = useWindowControls()
  // Os botões do sistema não acompanham a escala: o recuo volta ao tamanho de tela.
  const headerStyle = useMemo(
    () => ({
      zoom,
      ...(controls.left ? { paddingLeft: controls.left / zoom } : {}),
      ...(controls.right ? { paddingRight: (controls.right + 8) / zoom } : {})
    }),
    [zoom, controls.left, controls.right]
  )

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-bg">
      <ConversationView
        cwd={project.path}
        account={account}
        project={project.name}
        conversation={conversation}
        zoom={zoom}
        headerClassName="drag"
        headerStyle={headerStyle}
        onClose={onClose}
      />
    </div>
  )
}
