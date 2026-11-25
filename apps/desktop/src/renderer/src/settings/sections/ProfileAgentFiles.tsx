import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AGENT_SOURCES, type AgentSource, type ClaudeAction, type ClaudeItem, type ClaudeKind } from '@argus/shared/accountClaude';
import type { AuthState } from '@argus/shared/auth';
import type { ProviderId, ProvidersState } from '@argus/shared/providers';
import { useAuth } from '../../auth/useAuth';
import { useProviders } from '../../providers/useProviders';
import { AgentIcon } from '@argus/ui/icons/AgentIcon';
import { tr } from '../../i18n';
import { EmptyState } from '../../ui/emptyState/EmptyState';
import { AgentFilesArt, ConnectAgentArt } from '../../ui/emptyState/illustrations';
import { Button } from '../../ui/Button';
import { Tag } from '../../ui/Tag';
import { Row } from '../controls';

// Perfil > Instruções e skills: os arquivos de cada agente na conta (item 1f), uma seção por provedor
// conectado neste computador (Claude, Codex, Gemini e Antigravity, Cursor), uma abaixo da outra. Os
// daqui vão para a conta sozinhos; o que veio de outro computador só entra quando a pessoa importa, e
// quando os dois mudaram ela escolhe qual fica. Nunca sobrescreve sem perguntar.

const KIND: Record<ClaudeKind, () => string> = {
  instructions: () => tr('Instruções para todos os projetos', 'Instructions for every project'),
  skill: () => 'Skill',
  agent: () => tr('Agente', 'Agent'),
  command: () => tr('Comando', 'Command'),
};

// Igual aqui e na conta é o normal: sem texto, só a etiqueta.
function statusText(item: ClaudeItem): string | undefined {
  if (item.status === 'new') return tr('Veio de outro computador e ainda não está aqui', 'Came from another computer and is not here yet');
  if (item.status === 'updated') return tr('Tem uma versão nova na conta', 'Has a newer version in the account');
  if (item.status === 'conflict') return tr('Mudou aqui e na conta: escolha qual fica', 'Changed here and in the account: choose which one stays');
  return undefined;
}

function ItemActions({ item, busy, act }: { item: ClaudeItem; busy: boolean; act: (a: ClaudeAction, keys: string[]) => void }) {
  const keys = [item.key];
  if (item.status === 'conflict') {
    return (
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => act('keepLocal', keys)}>
          {tr('Manter o daqui', 'Keep this one')}
        </Button>
        <Button disabled={busy} onClick={() => act('import', keys)}>
          {tr('Usar o da conta', 'Use the account one')}
        </Button>
      </div>
    );
  }
  if (item.status === 'new' || item.status === 'updated') {
    return (
      <Button disabled={busy} onClick={() => act('import', keys)}>
        {item.status === 'new' ? tr('Importar', 'Import') : tr('Atualizar', 'Update')}
      </Button>
    );
  }
  return (
    <Button variant="ghost" danger disabled={busy} onClick={() => act('remove', keys)}>
      {tr('Tirar da conta', 'Remove from account')}
    </Button>
  );
}

const SOURCE_NAME: Record<AgentSource, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini e Antigravity', cursor: 'Cursor' };

// O que vai de cada um (como vai está uma vez só, no topo da aba).
const SOURCE_TEXT: Record<AgentSource, () => string> = {
  claude: () => tr('CLAUDE.md, skills, agentes e comandos.', 'CLAUDE.md, skills, agents and commands.'),
  codex: () => tr('AGENTS.md e skills.', 'AGENTS.md and skills.'),
  gemini: () => tr('GEMINI.md e comandos.', 'GEMINI.md and commands.'),
  cursor: () => tr('Comandos e skills. As regras ficam na nuvem do Cursor.', 'Commands and skills. Rules live in the Cursor cloud.'),
};

// O logo de cada um; Gemini e Antigravity dividem a seção, então vão os dois.
function SourceLogo({ source }: { source: AgentSource }) {
  if (source === 'claude') return <AgentIcon size={16} />;
  if (source === 'gemini') {
    return (
      <span className="flex items-center gap-1">
        <AgentIcon provider="gemini" size={16} />
        <AgentIcon provider="antigravity" size={16} />
      </span>
    );
  }
  return <AgentIcon provider={source} size={16} />;
}

// Conectado neste computador (Configurações > Contas): só esses ganham a seção. Gemini e Antigravity
// dividem o GEMINI.md, então basta um dos dois.
function connectedSources(auth: AuthState | null, providers: ProvidersState | null): AgentSource[] {
  const has = (p: ProviderId) => (providers?.providers[p].accounts.length ?? 0) > 0;
  const on: Record<AgentSource, boolean> = {
    claude: (auth?.accounts.length ?? 0) > 0,
    codex: has('codex'),
    gemini: has('gemini') || has('antigravity'),
    cursor: has('cursor'),
  };
  return AGENT_SOURCES.filter((s) => on[s]);
}

// Uma seção que abre e fecha: o provedor, o que vai dele, quantos itens tem (e quantos esperam
// ação), "Importar N" quando chegou mais de um, e os itens. Começa aberta só quando algo espera.
function SourceSection({ source, items, failed, busy, act }: { source: AgentSource; items: ClaudeItem[]; failed: boolean; busy: boolean; act: (a: ClaudeAction, keys: string[]) => void }) {
  const waiting = items.filter((i) => i.status === 'new' || i.status === 'updated');
  const attention = items.filter((i) => i.status !== 'synced').length;
  const [open, setOpen] = useState(attention > 0);
  // Cada provedor num bloco com fundo, separado do próximo pelo espaço; dentro, divisória entre os itens.
  return (
    <section className="mb-3 rounded-xl bg-fill px-5">
      <div className="flex items-center justify-between gap-6 py-4">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className="block min-w-0">
            <span className="flex items-center gap-2 text-[16px] text-text">
              <SourceLogo source={source} />
              {SOURCE_NAME[source]}
              {items.length > 0 && <span className="text-[15px] text-muted">{items.length}</span>}
              {attention > 0 && <span className="rounded-full bg-accent px-1.5 text-[12px] text-white">{tr(`${attention} esperando`, `${attention} waiting`)}</span>}
            </span>
            <span className="mt-0.5 block text-[15px] leading-relaxed text-muted">
              {failed ? tr('Não deu para buscar na conta agora. Confira a internet.', "Couldn't reach the account right now. Check your connection.") : SOURCE_TEXT[source]()}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {waiting.length > 1 && (
            <Button variant="primary" disabled={busy} onClick={() => act('import', waiting.map((i) => i.key))}>
              {tr(`Importar ${waiting.length}`, `Import ${waiting.length}`)}
            </Button>
          )}
          <button
            type="button"
            aria-label={open ? tr('Fechar', 'Collapse') : tr('Abrir', 'Expand')}
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-1 text-muted hover:bg-fill hover:text-text"
          >
            <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && !items.length && !failed && (
        <EmptyState
          size="sm"
          art={<AgentFilesArt />}
          title={tr(`Nada do ${SOURCE_NAME[source]} ainda`, `Nothing from ${SOURCE_NAME[source]} yet`)}
          text={tr('O que ele tiver aqui ou na conta aparece nesta lista.', 'What it has here or in the account shows up in this list.')}
        />
      )}
      {open && items.length > 0 && (
        <div className="border-t border-dashed border-line">
          {items.map((item) => (
            <Row key={item.key} label={item.name} tag={<Tag tone="info">{KIND[item.kind]()}</Tag>} description={statusText(item)}>
              <ItemActions item={item} busy={busy} act={act} />
            </Row>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProfileAgentFiles() {
  const [items, setItems] = useState<ClaudeItem[] | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const providers = useProviders();
  useEffect(() => {
    let alive = true;
    void window.api.account.claudeItems().then((list) => alive && setItems(list));
    return () => {
      alive = false;
    };
  }, []);

  const act = (action: ClaudeAction, keys: string[]) => {
    setBusy(true);
    void window.api.account.claudeAct(action, keys).then((list) => {
      setBusy(false);
      if (list) setItems(list);
    });
  };

  if (items === undefined) return null;
  const sources = connectedSources(auth, providers);
  if (!sources.length) {
    return (
      <EmptyState
        art={<ConnectAgentArt />}
        title={tr('Nenhum agente conectado', 'No agent connected')}
        text={tr(
          'Conecte um agente em Configurações > Contas. As instruções, skills e comandos dele passam a ir com a sua conta.',
          'Connect an agent in Settings > Accounts. Its instructions, skills and commands then travel with your account.',
        )}
      />
    );
  }
  return (
    <>
      <p className="py-5 text-[15px] leading-relaxed text-muted">
        {tr(
          'O que é deste computador vai para a conta sozinho. O que vem de outro só entra quando você importa.',
          'What is on this computer goes to the account on its own. What comes from another one only lands when you import it.',
        )}
      </p>
      {sources.map((source) => (
        <SourceSection key={source} source={source} items={(items ?? []).filter((i) => i.source === source)} failed={items === null} busy={busy} act={act} />
      ))}
    </>
  );
}
