import { useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { LOCALE, tr } from '../i18n';
import { Presence } from '../motion';
import { IS_REMOTE } from '../remote';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import type { UpdateTrouble as Trouble } from './trouble';

// Página de download do site: acha o instalador do sistema de quem abre (pelo servidor do site, que
// funciona mesmo com o GitHub fora do ar na rede da pessoa) e, no Mac, mostra o comando do terminal
// que instala sem o aviso de desenvolvedor não identificado.
const DOWNLOAD_URL = 'https://argusterm.com/download.html';

// Barra de título, ao lado da versão: a atualização não funciona há um dia ou mais (ver
// trouble.ts). O clique abre o motivo e a saída manual: baixar o instalador e instalar por cima.
export function UpdateTrouble({ trouble, version }: { trouble: Trouble; version: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={tr('Ver por que o Argus não está atualizando', "See why Argus isn't updating")}
        className="no-drag flex items-center gap-1.5 rounded-md border border-line bg-fill px-2.5 py-0.5 text-[12px] text-text hover:bg-surface-2"
      >
        <TriangleAlert size={14} className="text-needs-you" />
        {tr('Não deu para atualizar', "Couldn't update")}
      </button>
      {/* No body: dentro da barra, o modal ficaria preso na camada (z-35) dela. */}
      {createPortal(
        <Presence kind="modal">{open && <TroubleModal trouble={trouble} version={version} onClose={() => setOpen(false)} />}</Presence>,
        document.body,
      )}
    </>
  );
}

// Na janela de acesso remoto, o link abriria o navegador deste computador, não o do que precisa
// atualizar: lá o texto diz onde baixar, sem o botão.
function TroubleModal({ trouble, version, onClose }: { trouble: Trouble; version: string; onClose: () => void }) {
  const since = new Date(trouble.since).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
  const retry = () => {
    void window.api.updates.check();
    onClose();
  };
  // Abre no navegador do sistema (ver openLinksOutside, no processo principal).
  const download = () => {
    window.open(DOWNLOAD_URL, '_blank');
    onClose();
  };

  return (
    <Modal variant="alert" size="auto" className="w-[min(440px,calc(100vw-32px))]" labelledBy="update-trouble-title" onClose={onClose}>
      <div className="flex items-start gap-3">
        <TriangleAlert size={18} className="mt-px shrink-0 text-needs-you" aria-hidden="true" />
        <h2 id="update-trouble-title" className="min-w-0 text-sm font-semibold">
          {tr('Não deu para atualizar o Argus', "Couldn't update Argus")}
        </h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {tr(
          `Você está na versão ${version}, e a atualização automática não funciona desde ${since}:`,
          `You're on version ${version}, and automatic updates haven't worked since ${since}:`,
        )}
      </p>
      <p className="mt-2 rounded-md bg-fill px-3 py-2 text-[13px] leading-relaxed break-words text-text">{trouble.reason}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {IS_REMOTE
          ? tr(
              'Baixe o instalador no próprio computador, em argusterm.com/download, e instale por cima. Conversas, workspaces e configurações continuam.',
              'Download the installer on that computer, at argusterm.com/download, and install it over this one. Chats, workspaces and settings stay.',
            )
          : tr(
              'Baixe o instalador da versão mais recente e instale por cima. Conversas, workspaces e configurações continuam.',
              'Download the latest installer and install it over this one. Chats, workspaces and settings stay.',
            )}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>{tr('Fechar', 'Close')}</Button>
        {trouble.canRetry && <Button onClick={retry}>{tr('Tentar de novo', 'Try again')}</Button>}
        {!IS_REMOTE && (
          <Button variant="primary" autoFocus onClick={download}>
            {tr('Baixar instalador', 'Download installer')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
