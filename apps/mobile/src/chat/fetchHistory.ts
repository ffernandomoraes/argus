import type { HistoryPage, HistoryRequest, Message } from '@argus/shared/history';
import { applyPatch, messageSignature, type HistoryHave } from '@argus/shared/historyPatch';
import type { HostConnection } from '../net/connection';

// O trecho do histórico, pedindo só o que mudou desde o que a tela já mostra (ver
// shared/historyPatch.ts). Sem nada na tela, ou com o computador numa versão sem o pedido novo, vai
// o trecho inteiro, como antes.

// As mensagens mostradas são os mesmos objetos entre uma leitura e outra (reuseMessages): a
// assinatura de cada uma é calculada uma vez só.
const signatures = new WeakMap<Message, string>();

function signatureOf(m: Message): string {
  let s = signatures.get(m);
  if (s === undefined) {
    s = messageSignature(m);
    signatures.set(m, s);
  }
  return s;
}

// O computador de casa respondeu que não conhece o pedido (versão anterior do Argus): até recarregar
// o app, só o trecho inteiro.
let patchUnsupported = false;

// known: as mensagens que a tela mostra agora.
type Wanted = { cwd: string; id: string; request: HistoryRequest; known: readonly Message[] };

export async function fetchHistory(conn: HostConnection, { cwd, id, request, known }: Wanted): Promise<HistoryPage> {
  if (known.length && !patchUnsupported) {
    const have: HistoryHave = {};
    for (const m of known) have[m.id] = signatureOf(m);
    try {
      const page = applyPatch(await conn.call('sessions:historyPatch', cwd, id, request, have), known);
      if (page) return page;
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('sessions:historyPatch'))) throw err;
      patchUnsupported = true;
    }
  }
  return conn.call('sessions:historyPage', cwd, id, request);
}
