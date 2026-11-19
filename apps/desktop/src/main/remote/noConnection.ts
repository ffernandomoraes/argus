import { tr } from '../i18n';

// O erro de quem pediu algo ao outro computador com a ligação caída. A janela já mostra o
// "reconectando" e recarrega quando a ligação volta: não é defeito, e não vai ao Sentry (ARGUS-P a W,
// 2026-11-19: um aviso por pedido que a página fez ao abrir sem ligação).
const PT = 'Sem ligação com o outro computador.';
const EN = 'No connection to the other computer.';

export const noConnection = (): Error => new Error(tr(PT, EN));

// Nos dois idiomas: o app pode ter trocado de idioma entre o erro e o envio.
export const isNoConnectionMessage = (text: string | undefined): boolean =>
  !!text && (text.includes(PT) || text.includes(EN));
