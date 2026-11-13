import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight } from 'lucide-react';
import type { ClaudeModel } from '@argus/shared/models';
import { useClaudeVersion } from '../../claudeVersion/useClaudeVersion';
import { Presence } from '../../motion';
import { MENU_ACTIVE, MENU_HOVER } from '../../ui/menuStyles';
import { groupByFamily } from '../modelOptions';
import { POPOVER } from '../popover';
import { tr } from '../../i18n';

const PICKER_ROW = `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text ${MENU_HOVER}`;

// Modelos do menu, agrupados por família ("Opus", "Sonnet"...), com as versões num submenu ao lado.
// O padrão do Claude Code vem primeiro, com o modelo a que aponta hoje. Nasce com o submenu fechado:
// o menu monta de novo a cada vez que abre.
export function ModelList({
  models,
  value,
  onChange,
  submenuRef,
}: {
  models: ClaudeModel[]
  value: string
  onChange: (model: string) => void
  // Submenu aberto (vai para o body): o clique nele não conta como "fora" do menu.
  submenuRef: RefObject<HTMLDivElement | null>
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const defaultModel = models.find((m) => m.value === '');
  const rows = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    // Sem rolagem aqui: o submenu das versões é posicionado pela linha medida ao abrir
    <div>
      <div className="px-2 pb-1 pt-1.5 text-[12px] text-faint">{tr('Modelo', 'Model')}</div>
      {models.length === 0 && <div className="px-2 py-1.5 text-xs text-faint">{tr('Carregando modelos…', 'Loading models…')}</div>}

      {defaultModel && (
        <button onClick={() => onChange('')} className={PICKER_ROW}>
          <span className="flex-1">
            {tr('Padrão', 'Default')}
            {defaultModel.resolvedName && <span className="text-faint"> - {defaultModel.resolvedName}</span>}
          </span>
          {value === '' && <Check size={13} className="text-muted" />}
        </button>
      )}

      {groupByFamily(models).map(([family, versions]) => {
        const selected = versions.find((v) => v.value === value);
        const isOpen = expanded === family;
        return (
          <div
            key={family}
            ref={(el) => {
              rows.current[family] = el;
            }}
            onMouseEnter={() => setExpanded(family)}
            onMouseLeave={() => setExpanded((f) => (f === family ? null : f))}
          >
            <button onClick={() => setExpanded(isOpen ? null : family)} className={`${PICKER_ROW} ${isOpen ? MENU_ACTIVE : ''}`}>
              <span className="flex-1">{family}</span>
              {selected && <span className="text-[12px] text-faint">{selected.displayName}</span>}
              {selected && <Check size={13} className="text-muted" />}
              <ChevronRight size={12} className="shrink-0 text-faint" />
            </button>
            {createPortal(
              <Presence kind="menu">
                {isOpen && (
                  <VersionsSubmenu row={rows.current[family]} panelRef={submenuRef}>
                  {versions.map((v) => (
                    <button key={v.value} onClick={() => onChange(v.value)} className={PICKER_ROW}>
                      <span className="flex-1">{v.displayName}</span>
                      {value === v.value && <Check size={13} className="text-muted" />}
                    </button>
                  ))}
                  </VersionsSubmenu>
                )}
              </Presence>,
              document.body,
            )}
          </div>
        );
      })}
      <OutdatedNotice />
    </div>
  );
}

// Folga até a borda da janela.
const EDGE = 8;
// Largura do submenu (w-52) mais o vão que mantém o mouse "dentro" ao atravessar até ele.
const WIDTH = 208;
const GAP = 4;

// Submenu ao lado do item. Vai para o body com posição fixa: dentro do card da conversa, a borda dele
// cortava o submenu quando o card é estreito, e o vidro do menu (backdrop-filter) deixava o submenu
// transparente. Abre para a esquerda (o menu do modelo fica no canto direito do rodapé); sem espaço,
// para a direita do menu; sem espaço nos dois, encosta na borda da janela. Perto do pé da janela,
// sobe o quanto faltar. Medido ao montar, antes de aparecer na tela.
function VersionsSubmenu({
  row,
  panelRef,
  children,
}: {
  row: HTMLDivElement | null
  panelRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const [pos, setPos] = useState<{ left: number; top: number; side: 'left' | 'right' } | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || !row) return;
    const anchor = row.getBoundingClientRect();
    const height = el.offsetHeight;
    const width = WIDTH + GAP;
    const side = anchor.left - width >= EDGE || anchor.right + width > window.innerWidth - EDGE ? 'left' : 'right';
    const left = side === 'left' ? Math.max(EDGE, anchor.left - width) : anchor.right;
    const up = Math.max(0, Math.min(anchor.top + height - (window.innerHeight - EDGE), anchor.top - EDGE));
    setPos({ left, top: anchor.top - up, side });
  }, [row]);

  return (
    <div
      ref={(el) => {
        if (el) panelRef.current = el;
        else if (panelRef.current === panel.current) panelRef.current = null;
        panel.current = el;
      }}
      className={`fixed z-[100] ${pos?.side === 'right' ? 'pl-1' : 'pr-1'}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {/* Agentes com muitas versões de uma família (o Cursor): rola dentro do submenu. */}
      <div className={`max-h-80 w-52 overflow-y-auto ${POPOVER}`}>{children}</div>
    </div>
  );
}

// Claude Code bem atrás da versão publicada: os modelos novos faltam na lista. O botão atualiza ali
// mesmo; o erro, se houver, fica por extenso em Configurações > Atualizações.
function OutdatedNotice() {
  const version = useClaudeVersion();
  if (!version?.farBehind || !version.current) return null;
  return (
    <div className="mx-1 mb-1 mt-1.5 rounded-md bg-fill px-2 py-1.5 text-[12px] leading-relaxed text-muted">
      {version.updating
        ? tr('Atualizando o Claude Code…', 'Updating Claude Code…')
        : version.error
          ? tr('A atualização do Claude Code falhou. Detalhes em Configurações > Atualizações.', 'The Claude Code update failed. Details in Settings > Updates.')
          : tr(
              `Claude Code ${version.current.version} desatualizado: a ${version.latest} traz os modelos novos.`,
              `Claude Code ${version.current.version} is outdated: ${version.latest} brings the new models.`,
            )}
      {!version.updating && (
        <button onClick={() => void window.api.claudeVersion.update()} className="ml-1 text-accent hover:underline">
          {version.error ? tr('Tentar de novo', 'Try again') : tr('Atualizar', 'Update')}
        </button>
      )}
    </div>
  );
}
