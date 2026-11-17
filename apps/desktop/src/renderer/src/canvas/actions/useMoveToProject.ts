import { useCallback, useMemo } from 'react';
import type { ConfirmRequest } from '../ConfirmDialog';
import type { DrawerCommands } from '../drawers/useDrawers';
import { removeNode } from '../operations';
import { getSessions, refreshNow } from '../sessionsStore';
import type { ChatNode, ProjectNode } from '../types';
import type { NodesApi } from './types';
import { tr } from '../../i18n';

// "Mover para projeto": o arquivo da conversa vai para a pasta do projeto (sessions/move.ts no
// processo principal), o card solto sai do canvas e a conversa aparece na lista da pasta. O
// painel que a mostrava (drawer ou bloco no canvas) passa a ser da pasta. Sem ⌘Z: o arquivo já mudou.
export function useMoveToProject({ nodesRef, change }: Pick<NodesApi, 'nodesRef' | 'change'>, drawers: DrawerCommands, confirm: (r: ConfirmRequest) => void) {
  const moveToProject = useCallback(
    (chatId: string, projectId: string) => {
      const chat = nodesRef.current.find((n): n is ChatNode => n.id === chatId && n.type === 'chat');
      const project = nodesRef.current.find((n): n is ProjectNode => n.id === projectId && n.type === 'project');
      if (!chat || !project) return;
      const { sessionId, path } = chat.data;
      void window.api.sessions.move(path, project.data.path, sessionId).then((error) => {
        if (error) return confirm({ title: tr('Não deu para mover a conversa', "Couldn't move the chat"), description: error });
        drawers.moved(sessionId, sessionId, project.id);
        change((ns) =>
          removeNode(ns, chat.id).map((n) =>
            n.type === 'chatPanel' && n.data.sessionId === sessionId
              ? { ...n, data: { ...n.data, path: project.data.path, projectName: project.data.name } }
              : n,
          ),
        );
        refreshNow(path);
        refreshNow(project.data.path);
      });
    },
    [nodesRef, change, drawers, confirm],
  );
  // Arrastada até a pasta: pergunta antes, porque soltar ali pode ser sem querer e não tem ⌘Z.
  const dropOnProject = useCallback(
    (chatId: string, projectId: string) => {
      const chat = nodesRef.current.find((n): n is ChatNode => n.id === chatId && n.type === 'chat');
      const project = nodesRef.current.find((n): n is ProjectNode => n.id === projectId && n.type === 'project');
      if (!chat || !project) return;
      const title = getSessions(chat.data.path).find((c) => c.id === chat.data.sessionId)?.title ?? chat.data.name;
      confirm({
        title: tr(`Mover "${title}" para ${project.data.name}?`, `Move "${title}" to ${project.data.name}?`),
        description: tr(
          'A conversa sai do canvas e passa para a lista da pasta. Daqui para frente, o Claude trabalha na pasta do projeto.',
          'The chat leaves the canvas and joins the folder list. From now on, Claude works in that folder.',
        ),
        confirmLabel: tr('Mover', 'Move'),
        onConfirm: () => moveToProject(chatId, projectId),
      });
    },
    [nodesRef, confirm, moveToProject],
  );

  return useMemo(() => ({ moveToProject, dropOnProject }), [moveToProject, dropOnProject]);
}
