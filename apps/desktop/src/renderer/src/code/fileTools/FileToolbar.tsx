import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Code2, Ellipsis, MessageSquarePlus, Undo2 } from 'lucide-react';
import { ConfirmDialog } from '../../canvas/ConfirmDialog';
import { ContextMenu, type MenuItem, type MenuState } from '../../canvas/ContextMenu';
import { tr } from '../../i18n';
import { Presence } from '../../motion';
import { keys } from '../../platform';
import { IS_REMOTE } from '../../remote';
import { IconButton } from '../../ui/IconButton';
import { EDITOR_NAMES, useCodeEditors } from '../useCodeEditors';
import type { FileTools } from './useFileTools';

// Botões do cabeçalho do arquivo aberto: perguntar ao Claude sobre as linhas escolhidas e o menu com
// abrir no VS Code ou no Cursor e desfazer as alterações. Ir para a linha (⌃G) e quebra de linha (⌥Z)
// ficam só no atalho (useFileTools).
export function FileToolbar({ tools }: { tools: FileTools }) {
  const editors = useCodeEditors();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const items: MenuItem[] = [];
  // Na janela remota o arquivo é do outro computador: o editor daqui não o abre.
  if (!IS_REMOTE) {
    for (const id of editors)
      items.push({ type: 'action', label: tr(`Abrir no ${EDITOR_NAMES[id]}`, `Open in ${EDITOR_NAMES[id]}`), icon: Code2, onSelect: () => tools.openIn(id) });
  }
  if (tools.canDiscard) {
    if (items.length) items.push({ type: 'separator' });
    items.push({ type: 'action', label: tr('Desfazer alterações', 'Discard changes'), icon: Undo2, danger: true, onSelect: tools.discard });
  }

  return (
    <>
      <IconButton
        label={
          tools.canAsk
            ? tr(`Perguntar ao Claude sobre estas linhas (${keys('⌘L')})`, `Ask Claude about these lines (${keys('⌘L')})`)
            : tr('Abra uma conversa desta pasta para perguntar ao Claude', 'Open a chat in this folder to ask Claude')
        }
        disabled={!tools.canAsk}
        onClick={tools.ask}
      >
        <MessageSquarePlus size={14} />
      </IconButton>
      {items.length > 0 && (
        <IconButton
          label={tr('Mais', 'More')}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.left, y: r.bottom + 4, items });
          }}
        >
          <Ellipsis size={14} />
        </IconButton>
      )}
      {createPortal(<Presence kind="menu">{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}</Presence>, document.body)}
      {createPortal(
        <Presence kind="modal">{tools.confirm && <ConfirmDialog request={tools.confirm} onClose={tools.closeConfirm} />}</Presence>,
        document.body,
      )}
    </>
  );
}
