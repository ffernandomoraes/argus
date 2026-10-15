import { memo, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Code2, Folder, FolderOpen, Loader2, Play, Plus } from 'lucide-react'
import { baseName, FILE_MANAGER, parentDir } from '../../platform'
import { useCanvasActions } from '../CanvasContext'
import { ContextMenu, type MenuItem } from '../ContextMenu'
import { useBranch, useUncommitted } from '../sessionsStore'
import { useIsCodeOpen } from '../useCanvasView'
import { serverMenuItems } from '../../devServers/ProjectServerButton'
import { startProjectServer, stopProjectServer, useProjectServer } from '../../devServers/projectServers'
import { BranchSwitcher } from './BranchSwitcher'
import { tr } from '../../i18n'

// As pastas do workspace, no pé do card: o que as conversas dele enxergam, cada uma com a branch em
// que está (como a lista de repositórios do VS Code), para ver de cara uma na main e outra numa
// branch de funcionalidade. Servidor e código de cada pasta ficam no botão direito dela, para a
// linha não encher de botões. "Adicionar pasta" abre o seletor do sistema.
export const WorkspaceFolders = memo(function WorkspaceFolders({ nodeId, folders }: { nodeId: string; folders: string[] }) {
  const { addWorkspaceFolder } = useCanvasActions()
  return (
    <ul className="border-t border-line px-1.5 py-1">
      {folders.map((f) => (
        <FolderRow key={f} folder={f} />
      ))}
      <li>
        <button
          onClick={(e) => {
            e.stopPropagation()
            addWorkspaceFolder(nodeId)
          }}
          className="nodrag flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left text-[12px] text-muted hover:bg-surface-2 hover:text-text"
        >
          <Plus size={13} className="shrink-0" />
          {tr('Adicionar pasta', 'Add folder')}
        </button>
      </li>
    </ul>
  )
})

// Uma pasta: nome e, embaixo, a pasta de cima; à direita, a branch (clicar troca, como o selo acima
// da pasta comum; fora de repositório, sem). O botão direito abre o menu da pasta, não o do card.
function FolderRow({ folder }: { folder: string }) {
  const branch = useBranch(folder)
  const uncommitted = useUncommitted(folder)
  const items = useFolderMenu(folder)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  return (
    <li
      title={folder}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setMenuAt({ x: e.clientX, y: e.clientY })
      }}
      className={`group flex items-center gap-2 rounded-md px-1.5 py-1 ${menuAt ? 'bg-surface-2' : ''}`}
    >
      <Folder size={13} className="shrink-0 text-[#3d9df5]" />
      {/* Nome em cima e a pasta de cima embaixo: os botões ficam com a largura toda da linha. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-tight text-text">{baseName(folder)}</span>
        <span className="truncate font-mono text-[11px] leading-tight text-faint">{parentDir(folder)}</span>
      </div>
      <div className="nodrag flex min-w-0 shrink-0 items-center gap-0.5">
        {branch && (
          <div className="flex min-w-0 max-w-[140px]">
            <BranchSwitcher path={folder} branch={branch} changes={uncommitted?.length} />
          </div>
        )}
      </div>
      {/* No body: dentro do canvas o `fixed` seguiria o zoom e o deslocamento dele. */}
      {menuAt && createPortal(<ContextMenu menu={{ ...menuAt, items }} onClose={() => setMenuAt(null)} />, document.body)}
    </li>
  )
}

// Menu de uma pasta do workspace: o servidor (iniciar; rodando, abrir no navegador e encerrar), o
// código e o gerenciador de arquivos. Os itens acompanham o estado: aberto, o menu mostra a porta
// que subir depois.
function useFolderMenu(folder: string): MenuItem[] {
  const { toggleProjectCode } = useCanvasActions()
  const codeOpen = useIsCodeOpen(folder)
  const server = useProjectServer(folder)
  const project = useMemo(() => ({ name: baseName(folder), path: folder, color: '#71717a' }), [folder])

  // Sem script para rodar e nada de pé na pasta, o servidor não entra no menu.
  const serverItems: MenuItem[] = !server || (server.state === 'stopped' && !server.script)
    ? []
    : server.state === 'stopped'
      ? [{ type: 'action', label: tr(`Iniciar servidor - ${server.command}`, `Start server - ${server.command}`), icon: Play, onSelect: () => void startProjectServer(folder) }]
      : server.state === 'starting'
        ? [{ type: 'action', label: tr('Iniciando servidor', 'Starting server'), icon: Loader2, disabled: true, onSelect: () => {} }]
        : serverMenuItems(server, () => void stopProjectServer(folder))

  return [
    ...serverItems,
    ...(serverItems.length ? [{ type: 'separator' } as const] : []),
    {
      type: 'action',
      label: codeOpen ? tr('Fechar código', 'Close code') : tr('Ver código', 'View code'),
      icon: Code2,
      onSelect: () => toggleProjectCode(project, codeOpen)
    },
    {
      type: 'action',
      label: tr(`Abrir no ${FILE_MANAGER}`, `Open in ${FILE_MANAGER}`),
      icon: FolderOpen,
      onSelect: () => window.api.files.openFolder(folder)
    }
  ]
}
