import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { McpServerList } from '../../mcp/McpServerList';
import { useMcpServers, type McpSource } from '../../mcp/McpServers';
import { IconButton } from '../../ui/IconButton';
import { Group, Row, Select } from '../controls';
import { tr } from '../../i18n';

// Servidores MCP de uma conta, sem precisar abrir conversa: autorizar, reconectar e desconectar.
// Mostra os que valem em qualquer pasta (do usuário, conectores do claude.ai e plugins); os de
// projeto ficam no /mcp da conversa. Enquanto a aba está na tela, um `claude` da conta fica aberto
// (ver main/chats/accountMcp.ts).
export function McpSection() {
  const auth = useAuth();
  // Conta sem login não roda o `claude`: fora da lista, como no seletor de conta da conversa.
  const accounts = (auth?.accounts ?? []).filter((a) => a.status?.loggedIn !== false);
  const [chosen, setChosen] = useState<string | null>(null);
  const account = (accounts.find((a) => a.id === chosen) ?? accounts.find((a) => a.id === auth?.defaultId) ?? accounts[0])?.id ?? '';

  const source = useMemo<McpSource>(
    () => ({
      status: (wait) => window.api.accountMcp.status(account, wait),
      reconnect: (name) => window.api.accountMcp.reconnect(account, name),
      authenticate: (name) => window.api.accountMcp.authenticate(account, name),
      submitCallback: (name, url) => window.api.accountMcp.submitCallback(account, name, url),
      clearAuth: (name) => window.api.accountMcp.clearAuth(account, name),
      remove: (name, scope) => window.api.accountMcp.remove(account, name, scope),
    }),
    [account],
  );
  const state = useMcpServers(source);

  // Saiu da aba (ou trocou de conta): o `claude` daquela conta fecha.
  useEffect(() => () => window.api.accountMcp.release(account), [account]);

  return (
    <>
      {accounts.length > 1 && (
        <Group>
          <Row label={tr('Conta', 'Account')} description={tr('Cada conta do Claude tem os seus logins nos servidores.', 'Each Claude account has its own server logins.')}>
            <Select
              value={account}
              onChange={setChosen}
              label={tr('Conta', 'Account')}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Row>
        </Group>
      )}
      <div className="flex items-center justify-end pb-2 pt-4 first:pt-0">
        <IconButton label={tr('Atualizar', 'Refresh')} onClick={state.refresh} disabled={state.loading}>
          <RefreshCw size={14} className={state.loading ? 'animate-spin' : ''} />
        </IconButton>
      </div>
      <McpServerList variant="cards" state={state} empty={tr('Nenhum servidor MCP nesta conta.', 'No MCP servers on this account.')} />
    </>
  );
}
