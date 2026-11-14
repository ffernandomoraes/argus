import { useEffect } from 'react';
import { tr } from '../i18n';
import { createFolderInstance, findFolderNode } from './factory';
import { addNode } from './operations';
import type { CanvasNode } from './types';

// O app do celular adicionando uma pasta a um workspace (que pode não ser o desta janela): esta
// janela só calcula o encaixe, com a mesma lógica de quando se adiciona aqui (dentro do grupo, o
// grupo crescendo, os vizinhos se afastando), e o processo principal grava e manda para todas as
// janelas (ver main/phoneCanvas.ts).
export function usePhoneFolders(): void {
  useEffect(
    () =>
      window.api.canvas.onPlaceFolder((req) => {
        try {
          const nodes = (Array.isArray(req.nodes) ? req.nodes : []) as CanvasNode[];
          if (findFolderNode(nodes, req.path)) return window.api.canvas.placedFolder(req.id, null, tr('Essa pasta já está neste workspace.', 'That folder is already in this workspace.'));
          const group = req.groupId ? nodes.find((n) => n.id === req.groupId && n.type === 'area') : undefined;
          if (req.groupId && !group) return window.api.canvas.placedFolder(req.id, null, tr('Esse grupo não existe mais.', 'That group no longer exists.'));
          window.api.canvas.placedFolder(req.id, addNode(nodes, createFolderInstance({ x: 0, y: 0 }, req.path), group?.id), null);
        } catch (err) {
          window.api.canvas.placedFolder(req.id, null, err instanceof Error ? err.message : String(err));
        }
      }),
    [],
  );
}
