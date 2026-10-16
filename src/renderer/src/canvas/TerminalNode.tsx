import { memo, useRef, useState } from 'react'
import { parseAgentRef } from '../../../shared/providers'
import type { NodeProps } from '@xyflow/react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { AccountTag } from '../conversation/header/AccountTag'
import { TerminalView } from '../conversation/TerminalView'
import { usePreferences } from '../settings/preferences'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { BlockFrame } from './blocks/BlockFrame'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useGroupOf } from './blocks/useGroupOf'
import { useCanvasActions } from './CanvasContext'
import { TerminalBinding } from './terminal/TerminalBinding'
import { TerminalFocusLayer } from './terminal/TerminalFocusLayer'
import { TerminalHeader } from './terminal/TerminalHeader'
import { useFocusMode } from './terminal/useFocusMode'
import type { TerminalNode as TerminalNodeType } from './types'
import { useIsNewBlock } from './useCanvasView'
import { baseName } from '../platform'
import { tr } from '../i18n'

// Botões do cabeçalho: o último encosta na borda direita, como nos outros blocos.
const HEADER_BUTTON = 'nodrag last:-mr-1'

// Terminal de verdade morando no canvas, ao lado das pastas: o `claude` ou o shell do sistema.
// O processo vive no processo principal: mover, recolher o grupo ou fechar o app não derruba a sessão.
function TerminalNodeView({ id, data, selected, parentId }: NodeProps<TerminalNodeType>) {
  const shell = data.kind === 'shell'
  // Conta do grupo onde o terminal está. Vale ao abrir: o terminal aberto segue na dele.
  const group = useGroupOf(parentId)
  const account = data.account ?? group.account
  const agent = parseAgentRef(account)?.provider
  const { closeTerminal, setTerminalAccount } = useCanvasActions()
  // Trocar a conta encerra o `claude` e abre de novo com ela, na mesma conversa (as conversas
  // ficam numa pasta só para todas as contas). Só no do Claude, com mais de uma conta dele.
  const [relaunch, setRelaunch] = useState(0)
  const claudeAccounts = useAuth()?.accounts.length ?? 0
  const accountTag =
    !shell && !agent && claudeAccounts > 1 ? (
      <AccountTag
        account={account}
        claudeOnly
        onChange={(next) => {
          if (next === account) return
          window.api.terminal.kill(id)
          setTerminalAccount(id, next)
          setRelaunch((n) => n + 1)
        }}
      />
    ) : undefined
  const focusRef = useRef<HTMLDivElement>(null)
  const focus = useFocusMode(focusRef)
  // No foco, ⌘+ e ⌘- mudam a fonte, na mesma escala do drawer.
  const zoom = usePreferences().drawerZoom
  // Só o terminal recém-criado pega o foco no canvas; o do modo foco sempre (a pessoa pediu).
  const isNew = useIsNewBlock(id)
  // Workspace: as pastas dele no lugar do caminho (a pasta do workspace em si é só um id).
  const pathLabel = data.folders ? data.folders.map(baseName).join(', ') : data.path

  const terminal = (inFocusMode: boolean) => (
    <TerminalView
      sessionKey={id}
      cwd={data.path}
      folders={data.folders}
      account={account}
      shell={shell}
      sessionId={data.sessionId}
      fontScale={inFocusMode ? zoom : undefined}
      autoFocus={inFocusMode || isNew}
      gpu={inFocusMode}
      relaunch={relaunch}
    />
  )

  return (
    <>
      {/* Até saber qual é a conversa que o `claude` daqui criou (ver TerminalBinding). */}
      {!shell && !data.sessionId && <TerminalBinding nodeId={id} />}
      <BlockFrame selected={selected} minHeight={220} className="bg-surface">
        <TerminalHeader nodeId={id} name={data.name} path={pathLabel} shell={shell} agent={agent} account={accountTag}>
          <IconButton label={tr('Modo foco', 'Focus mode')} variant="subtle" size="sm" className={HEADER_BUTTON} onClick={focus.enter}>
            <Maximize2 size={13} />
          </IconButton>
          <IconButton
            label={tr('Fechar terminal', 'Close terminal')}
            variant="subtle"
            size="sm"
            className={HEADER_BUTTON}
            onClick={() => closeTerminal(id, data.name)}
          >
            <X size={14} />
          </IconButton>
        </TerminalHeader>

        {/* nodrag/nowheel: digitar e rolar valem para o terminal, não para o canvas */}
        <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
          {focus.active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-surface text-xs text-muted">
              {tr('Em modo foco', 'In focus mode')}
              <Button size="sm" onClick={focus.exit}>
                {tr('Sair do modo foco', 'Exit focus mode')}
              </Button>
            </div>
          ) : (
            terminal(false)
          )}
        </div>
      </BlockFrame>

      {focus.active && (
        <TerminalFocusLayer panelRef={focusRef}>
          <TerminalHeader nodeId={id} name={data.name} path={pathLabel} shell={shell} agent={agent} account={accountTag}>
            <IconButton label={tr('Sair do modo foco', 'Exit focus mode')} variant="subtle" size="sm" className={HEADER_BUTTON} onClick={focus.exit}>
              <Minimize2 size={13} />
            </IconButton>
          </TerminalHeader>
          {terminal(true)}
        </TerminalFocusLayer>
      )}
    </>
  )
}

// Arrastar o terminal não redesenha o conteúdo dele (ver sameNodeProps).
export const TerminalNode = memo(TerminalNodeView, sameNodeProps)
