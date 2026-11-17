import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ContextMenu, type MenuState } from '../../canvas/ContextMenu';
import { useUncommitted } from '../../canvas/sessionsStore';
import { KIND_COLOR } from '../../conversation/header/changeKinds';
import { tr } from '../../i18n';
import { Presence } from '../../motion';
import { useDraftPaths } from '../drafts';
import { changesInTree } from '../tree/treePaths';
import { useTabs } from './openTabs';

type Props = {
  root: string
  // O arquivo à vista.
  active: string
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
};

// Abas dos arquivos abertos, acima do arquivo, como no VS Code: o nome com a cor do git e a bolinha
// de não salvo; o X (ou o clique do meio) fecha. A aba à vista fica sempre à mostra ao rolar.
export function FileTabs({ root, active, onSelect, onClose, onCloseOthers }: Props) {
  const tabs = useTabs(root);
  const drafts = useDraftPaths(root);
  const uncommitted = useUncommitted(root);
  const changes = useMemo(() => changesInTree(root, uncommitted), [root, uncommitted]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active, tabs]);

  return (
    <div
      ref={stripRef}
      role="tablist"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line bg-surface [scrollbar-width:none]"
    >
      {tabs.map((path) => {
        const selected = path === active;
        const change = changes.get(path);
        const dirty = drafts.has(path);
        return (
          <div
            key={path}
            role="tab"
            aria-selected={selected}
            title={path}
            onClick={() => !selected && onSelect(path)}
            onAuxClick={(e) => e.button === 1 && onClose(path)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  { type: 'action', label: tr('Fechar', 'Close'), onSelect: () => onClose(path) },
                  { type: 'action', label: tr('Fechar as outras', 'Close others'), onSelect: () => onCloseOthers(path) },
                ],
              });
            }}
            className={`group flex max-w-48 shrink-0 cursor-default items-center gap-1.5 border-r border-line pr-1 pl-3 text-xs ${
              selected ? 'bg-[#1e1e1e] text-text' : 'text-muted hover:bg-fill hover:text-text'
            }`}
          >
            <span className={`truncate ${change ? KIND_COLOR[change] : ''}`}>{path.slice(path.lastIndexOf('/') + 1)}</span>
            <button
              aria-label={tr('Fechar aba', 'Close tab')}
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
              className={`grid size-5 shrink-0 place-items-center rounded-md hover:bg-surface-2 ${
                selected || dirty ? '' : 'invisible group-hover:visible'
              }`}
            >
              {/* Não salvo: a bolinha no lugar do X, que aparece ao passar o mouse. */}
              {dirty ? (
                <>
                  <span className="size-1.5 rounded-full bg-text group-hover:hidden" />
                  <X size={12} className="hidden group-hover:block" />
                </>
              ) : (
                <X size={12} />
              )}
            </button>
          </div>
        );
      })}
      {createPortal(<Presence kind="menu">{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}</Presence>, document.body)}
    </div>
  );
}
