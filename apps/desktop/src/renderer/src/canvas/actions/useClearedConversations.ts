import { useEffect } from 'react';
import { choiceOf, freezeChoice } from '../../conversation/conversationChoices';
import { tr } from '../../i18n';
import type { DrawerCommands } from '../drawers/useDrawers';
import type { CanvasNode } from '../types';
import type { NodesApi } from './types';

// O card ou o bloco fixado que mostrava a conversa antiga passa para a nova, no mesmo lugar.
export function clearedNodes(nodes: CanvasNode[], from: string, to: string): CanvasNode[] {
  if (!nodes.some((n) => (n.type === 'chat' || n.type === 'chatPanel') && n.data.sessionId === from)) return nodes;
  const name = tr('Nova conversa', 'New chat');
  return nodes.map((n) =>
    (n.type === 'chat' || n.type === 'chatPanel') && n.data.sessionId === from ? ({ ...n, data: { ...n.data, sessionId: to, name } } as CanvasNode) : n,
  );
}

// /clear (ou /reset, /new, ou o modo plano saindo com o contexto limpo): o Claude Code segue no mesmo
// processo numa sessão nova, em outro arquivo (ver readReset em main/chats/stream.ts). Sem isto, a
// tela continuava lendo o arquivo antigo: a conversa não sumia, o que vinha depois não aparecia, e o
// card reabria a antiga. Aqui quem mostrava a antiga passa para a nova, com a mesma conta e os mesmos
// ajustes; a antiga fica na lista, como no /resume do terminal.
export function useClearedConversations({ nodesRef, setNodes }: Pick<NodesApi, 'nodesRef' | 'setNodes'>, drawers: DrawerCommands) {
  useEffect(() => {
    // A mesma troca chega uma vez por chave da conversa.
    const handled = new Set<string>();
    return window.api.chat.onState((_key, state) => {
      const from = state.clearedFrom;
      const to = state.sessionId;
      if (!from || !to || from === to || handled.has(to)) return;
      handled.add(to);
      const choice = choiceOf(from);
      if (choice) freezeChoice(to, choice);
      drawers.cleared(from, to);
      // Sem o desfazer: voltar o card para a conversa antiga deixaria a nova sem ninguém mostrando.
      if (nodesRef.current.some((n) => (n.type === 'chat' || n.type === 'chatPanel') && n.data.sessionId === from)) {
        setNodes((ns) => clearedNodes(ns, from, to));
      }
    });
  }, [nodesRef, setNodes, drawers]);
}
