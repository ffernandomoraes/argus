import { memo, useMemo } from 'react'
import { DesignDrawer } from '../../design/DesignDrawer'
import type { DesignView } from './drawerView'

// Drawer do design aberto. Recebe só valores simples: a lista de nós muda a cada quadro de um
// arraste, e o design não precisa redesenhar por isso.
function DesignPanelView({ designId, projectPath, projectName, account, tint, onClose }: DesignView & { onClose: () => void }) {
  const target = useMemo(() => ({ designId, projectPath, projectName }), [designId, projectPath, projectName])
  return <DesignDrawer target={target} account={account} tint={tint} onClose={onClose} />
}

export const DesignPanel = memo(DesignPanelView)
