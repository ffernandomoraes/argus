import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import type { McpSource } from '../mcp/McpServers'
import { McpServerList, useMcpServers } from '../mcp/McpServers'
import { IconButton } from '../ui/IconButton'
import { Modal } from '../ui/Modal'
import { ModalCloseButton } from '../ui/ModalCloseButton'
import { tr } from '../i18n'

// Lista dos servidores MCP da pasta, no lugar do /mcp que abriria uma tela no terminal. Cada conta
// tem os seus: sem conversa aberta, a consulta usa a conta do grupo.
export function McpPanel({
  conversationKey,
  cwd,
  account,
  onClose
}: {
  conversationKey: string
  cwd: string
  account?: string
  onClose: () => void
}) {
  const source = useMemo<McpSource>(
    () => ({
      status: () => window.api.chat.mcpStatus(conversationKey, cwd, account),
      reconnect: (name) => window.api.chat.mcpReconnect(conversationKey, name),
      authenticate: (name) => window.api.chat.mcpAuthenticate(conversationKey, name),
      clearAuth: (name) => window.api.chat.mcpClearAuth(conversationKey, name),
      remove: (name, scope) => window.api.chat.mcpRemove(conversationKey, cwd, account, name, scope)
    }),
    [conversationKey, cwd, account]
  )
  const state = useMcpServers(source)

  return (
    <Modal
      label={tr('Servidores MCP', 'MCP servers')}
      size="auto"
      className="flex h-[min(560px,100%)] w-[min(520px,100%)] flex-col"
      onClose={onClose}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{tr('Servidores MCP', 'MCP servers')}</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-faint">{cwd}</div>
        </div>
        <IconButton label={tr('Atualizar', 'Refresh')} onClick={state.refresh} disabled={state.loading}>
          <RefreshCw size={14} className={state.loading ? 'animate-spin' : ''} />
        </IconButton>
        <ModalCloseButton />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <McpServerList
          state={state}
          empty={tr('Nenhum servidor MCP configurado para esta pasta.', 'No MCP servers configured for this folder.')}
          notLive={tr(
            'Esta conversa ainda não abriu o agente: a lista mostra como os servidores ficam ao abrir. Para autorizar ou reconectar um, mande uma mensagem antes, ou use Configurações > MCP.',
            'This chat hasn’t started the agent yet: the list shows how the servers look when it starts. To authorize or reconnect one, send a message first, or use Settings > MCP.'
          )}
        />
      </div>
    </Modal>
  )
}
