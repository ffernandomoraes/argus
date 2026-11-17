import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { isMod } from '../../platform';
import { selectedText, type ExplorerTab } from './searchState';

// Aba do painel de código (árvore ou busca no conteúdo), o texto da busca pelo nome e os atalhos:
// ⌘P vai para a busca pelo nome; ⇧⌘F, para a busca no conteúdo, já com o texto selecionado no
// editor. Os dois só com o foco no painel: fora dele o ⌘P é o "Nova pasta" do canvas (NavBar).
export function useExplorerSearch() {
  const [tab, setTab] = useState<ExplorerTab>('files');
  const [nameQuery, setNameQuery] = useState('');
  // Novo a cada ⇧⌘F com texto selecionado (o mesmo texto duas vezes também preenche o campo).
  const [initialQuery, setInitialQuery] = useState<{ text: string } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ tab: ExplorerTab } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // O campo só existe visível depois do render da aba nova.
  useEffect(() => {
    if (!focusRequest) return;
    const input = (focusRequest.tab === 'files' ? nameRef : searchRef).current;
    input?.focus();
    input?.select();
  }, [focusRequest]);

  const show = (next: ExplorerTab, focus = true) => {
    setTab(next);
    if (focus) setFocusRequest({ tab: next });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!isMod(e) || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    const byName = key === 'p' && !e.shiftKey;
    const inFiles = key === 'f' && e.shiftKey;
    if (!byName && !inFiles) return;
    e.preventDefault();
    // A NavBar ouve na janela: sem isso, o ⌘P daqui também criaria uma pasta no canvas.
    e.stopPropagation();
    if (inFiles) {
      // Lido antes do foco ir para o campo (que desfaz a seleção do editor).
      const text = selectedText();
      if (text) setInitialQuery({ text });
    }
    show(byName ? 'files' : 'search');
  };

  return { tab, show, nameQuery, setNameQuery, initialQuery, nameRef, searchRef, onKeyDown };
}
