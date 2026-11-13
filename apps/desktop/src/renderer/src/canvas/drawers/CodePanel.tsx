import { memo, useCallback } from 'react'
import { CodeExplorer } from '../../code/CodeExplorer'
import { FileViewer } from '../../code/FileViewer'
import type { OpenFile } from './drawerState'
import type { DrawerCommands } from './useDrawers'

type Props = {
  root: string
  name: string
  file: OpenFile | null
  // Espaço ocupado pelos drawers à direita (drawerLayout).
  rightOffset: number | string
  commands: DrawerCommands
}

// Painel de código da pasta do drawer (ou da conversa do canvas que pediu), com o arquivo aberto
// ao lado da árvore.
function CodePanelView({ root, name, file, rightOffset, commands }: Props) {
  const onOpenFile = useCallback((path: string) => commands.selectFile(root, path), [commands, root])
  const onRenamed = useCallback((from: string, to: string) => commands.renamedFile(root, from, to), [commands, root])
  const onDeleted = useCallback((path: string) => commands.deletedFile(root, path), [commands, root])
  const shown = file?.root === root ? file : null

  return (
    <CodeExplorer
      root={root}
      name={name}
      selected={shown ? shown.path : null}
      rightOffset={rightOffset}
      onOpenFile={onOpenFile}
      onRenamed={onRenamed}
      onDeleted={onDeleted}
      onClose={commands.closeCode}
    >
      {shown && (
        <FileViewer
          // Outro arquivo começa do zero (rolagem, recargas); o mesmo só recarrega.
          key={`${shown.root}|${shown.path}`}
          root={shown.root}
          path={shown.path}
          lines={shown.lines}
          diff={!!shown.diff}
          onDiffChange={commands.setFileDiff}
          onClose={commands.closeFile}
          onCloseCode={commands.closeCode}
        />
      )}
    </CodeExplorer>
  )
}

export const CodePanel = memo(CodePanelView)
