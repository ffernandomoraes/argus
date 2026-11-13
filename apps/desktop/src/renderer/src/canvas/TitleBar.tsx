import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppWindow, Eye, EyeOff, ScrollText } from 'lucide-react';
import { TITLE_BAR_HEIGHT } from '../conversation/FloatingPanel';
import { NavButton } from '../ui/NavButton';
import { IS_REMOTE, REMOTE_HOST, useRemoteAccess } from '../remote';
import { Presence } from '../motion';
import { HealthAlert } from '../systemHealth/HealthAlert';
import { ReleaseNotesModal } from '../updates/ReleaseNotesModal';
import { useUpdates } from '../updates/useUpdates';
import { IS_MAC } from '../platform';
import { useWindowControls } from '../useWindowControls';
import { BoardSwitcher } from './bars/BoardSwitcher';
import { RemoteConnections } from './bars/RemoteConnections';
import { UpdateStatus } from './bars/UpdateStatus';
import { updateProgress } from './bars/updateProgress';
import { useNewWindowShortcut } from './bars/useNewWindowShortcut';
import type { ConfirmRequest } from './ConfirmDialog';
import { tr } from '../i18n';

const Divider = () => <span className="h-4 w-px bg-line" />;

// Barra de título, como a do VS Code: sem a barra do sistema, é ela que guarda os botões da janela
// (os semáforos do Mac à esquerda; minimizar, maximizar e fechar do Windows à direita), arrasta a
// janela e maximiza no duplo clique. Tem fundo próprio, para o título não brigar com o canvas; os
// painéis começam abaixo dela (PANEL_TOP).
// Mostra sempre o nome do app no meio; a conversa aberta fica só no título da janela (windowTitle).
// O workspace (o menu para trocar) fica na ponta esquerda em todo sistema: no Mac, logo depois dos
// semáforos; no Windows e no Linux, no canto, para não lotar a direita, que já tem minimizar,
// maximizar e fechar.
export const TitleBar = memo(function TitleBar({
  windowTitle,
  uiHidden,
  onToggleUi,
  confirm,
}: {
  windowTitle: string
  uiHidden: boolean
  onToggleUi: () => void
  confirm: (request: ConfirmRequest) => void
}) {
  const updates = useUpdates();
  const controls = useWindowControls();
  const status = updateProgress(updates?.state);
  const [notesOpen, setNotesOpen] = useState(false);
  useNewWindowShortcut();
  // Azul nos dois lados do acesso remoto: na janela que mostra outro computador e no computador que
  // está sendo usado de outro (com algum aparelho conectado agora).
  const access = useRemoteAccess();
  const beingAccessed = !!access?.devices.some((d) => d.connected);

  // Aparece no menu Janela e no Mission Control.
  useEffect(() => {
    document.title = windowTitle;
  }, [windowTitle]);

  return (
    // Acima do escurecimento do canvas (z-30), abaixo dos painéis (z-40) e dos modais (z-50). Com o
    // mouse em cima sobe acima de todos: os tooltips dos botões abrem para baixo, por cima do drawer.
    // Modal aberto cobre a barra, então o mouse nem chega nela.
    // O recuo acompanha o maior dos lados (o workspace à esquerda; ocultar, nova janela, às vezes
    // atualizar ao lado da versão e, fora do Mac, os botões da janela à direita) dos dois lados: o
    // título segue no centro sem encostar nele. Os limites e o player ficam na barra de baixo (BottomBar).
    <div
      style={{ height: TITLE_BAR_HEIGHT }}
      className={`drag absolute inset-x-0 top-0 z-[35] flex items-center justify-center gap-2 border-b border-line ${IS_REMOTE || beingAccessed ? 'bg-remote-bar' : 'bg-surface'} hover:z-[55] ${status.ready || status.progress || !IS_MAC ? 'px-[20rem]' : 'px-[16rem]'}`}
    >
      <div className="absolute inset-y-0 flex items-center" style={{ left: 12 + controls.left }}>
        <BoardSwitcher confirm={confirm} align="start" />
      </div>
      <span className="text-[13px] font-semibold text-muted">Argus</span>
      {/* Janela de acesso remoto: o computador que ela mostra. */}
      {REMOTE_HOST && (
        <span
          title={tr('Acesso remoto', 'Remote access')}
          className="rounded-full border border-remote/40 bg-remote/10 px-2 py-px text-[11px] font-medium tracking-wide text-remote uppercase"
        >
          {REMOTE_HOST.name}
        </span>
      )}
      {/* Versões diferentes do Argus aqui e lá: funciona, mas o que um dos lados não conhece falha. */}
      {REMOTE_HOST?.clientVersion && REMOTE_HOST.clientVersion !== REMOTE_HOST.version && (
        <span
          title={tr(
            `Este Argus está na ${REMOTE_HOST.clientVersion} e o de ${REMOTE_HOST.name} na ${REMOTE_HOST.version}. Atualize os dois para a mesma versão; o de lá dá para atualizar daqui.`,
            `This Argus is on ${REMOTE_HOST.clientVersion} and the one on ${REMOTE_HOST.name} on ${REMOTE_HOST.version}. Update both to the same version; you can update the other one from here.`,
          )}
          className="rounded-full border border-dev/40 bg-dev/10 px-2 py-px text-[11px] font-medium tracking-wide text-dev uppercase"
        >
          {tr('Versões diferentes', 'Different versions')}
        </span>
      )}
      {/* Este computador com aparelhos conectados pelo acesso remoto: quantos (clique desconecta). */}
      <RemoteConnections />
      {/* Memória ou disco do computador chegando no limite (ou algo já encerrado por isso). */}
      <HealthAlert />
      {/* No pnpm dev, para distinguir do app instalado aberto ao mesmo tempo. */}
      {import.meta.env.DEV && (
        <span className="rounded-full border border-dev/40 bg-dev/10 px-2 py-px text-[11px] font-medium tracking-wide text-dev uppercase">
          {tr('Desenvolvimento', 'Development')}
        </span>
      )}
      <div className="absolute inset-y-0 flex items-center gap-2.5" style={{ right: 12 + controls.right }}>
        {updates && (
          <>
            {/* Fora da área que arrasta a janela, senão o botão não recebe o mouse. */}
            <span className="no-drag flex items-center gap-0.5">
              <NavButton
                label={uiHidden ? tr('Mostrar interface', 'Show interface') : tr('Ocultar interface', 'Hide interface')}
                shortcut={'⌘ \\'}
                compact
                selected={uiHidden}
                side="bottom-end"
                onClick={onToggleUi}
              >
                {uiHidden ? <Eye size={14} /> : <EyeOff size={14} />}
              </NavButton>
              {!IS_REMOTE && (
                <NavButton label={tr('Nova janela do canvas', 'New canvas window')} shortcut="⇧⌘N" compact side="bottom-end" onClick={() => window.api.canvas.newWindow()}>
                <AppWindow size={14} />
              </NavButton>
              )}
            </span>
            <Divider />
            <UpdateStatus version={updates.version} {...status} />
            {/* Novidades à direita da versão: o que mudou nela e nas anteriores. */}
            <span className="no-drag flex">
              <NavButton label={tr('Novidades', "What's new")} compact side="bottom-end" onClick={() => setNotesOpen(true)}>
                <ScrollText size={14} />
              </NavButton>
            </span>
          </>
        )}
      </div>
      {/* No body: dentro da barra, o modal ficaria preso na camada (z-35) dela. */}
      {createPortal(
        <Presence kind="modal">{notesOpen && updates && <ReleaseNotesModal current={updates.version} onClose={() => setNotesOpen(false)} />}</Presence>,
        document.body,
      )}
    </div>
  );
});
