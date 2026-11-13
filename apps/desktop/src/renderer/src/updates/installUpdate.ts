import { tr } from '../i18n';
import { IS_REMOTE, REMOTE_HOST } from '../remote';

// "Reiniciar e atualizar". Na janela de acesso remoto é o Argus do outro computador que reinicia: a
// pergunta fica aqui (lá não há ninguém para responder) e o de lá reinicia sem perguntar. A janela
// reconecta sozinha quando ele volta.
export function installUpdate(): void {
  if (IS_REMOTE) {
    const name = REMOTE_HOST?.name ?? '';
    const ok = window.confirm(
      tr(
        `O Argus de ${name} vai fechar e abrir de novo na versão nova. O que estiver trabalhando lá (conversas, terminais) para. Esta janela reconecta sozinha em seguida.`,
        `Argus on ${name} will close and reopen on the new version. Whatever is working there (chats, terminals) stops. This window reconnects on its own afterwards.`,
      ),
    );
    if (!ok) return;
  }
  window.api.updates.install();
}
