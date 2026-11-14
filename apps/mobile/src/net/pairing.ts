import { tr } from '../i18n';
import { clearCache } from '../lib/cache';
import { parsePairCode, type Link } from './crypto';
import { HandshakeError, pairAsClient } from './handshake';

// O computador pareado (guardado no aparelho), o endereço da ponte, o WebSocket como ligação e o
// pareamento pelo código. A conexão em si fica em connection.ts.

export type PairedHost = { hostId: string; hostName: string; deviceId: string; psk: string };

const STORE_KEY = 'argus-paired-host';

const b64 = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
export const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

export function loadPairedHost(): PairedHost | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PairedHost>;
    return typeof v.hostId === 'string' && typeof v.deviceId === 'string' && typeof v.psk === 'string' && typeof v.hostName === 'string'
      ? (v as PairedHost)
      : null;
  } catch {
    return null;
  }
}

function savePairedHost(host: PairedHost | null): void {
  try {
    if (host) localStorage.setItem(STORE_KEY, JSON.stringify(host));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    // Sem armazenamento: o pareamento vale até fechar a página.
  }
}

// A ponte publicada; no pnpm mobile:dev a página roda no localhost e fala com ela (ou com a de
// VITE_RELAY_URL, como a do `wrangler dev`).
const PUBLISHED_RELAY = 'wss://remote.argusterm.com';

// A ponte: a mesma origem da página (ela serve o app).
export function relayBase(): string {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  if (import.meta.env.DEV) return PUBLISHED_RELAY;
  return location.origin.replace(/^http/, 'ws');
}

class SocketClosed extends Error {
  constructor(readonly code: number) {
    super(`closed ${code}`);
  }
}

// WebSocket como Link. Recusado pela ponte (sem o de casa, código ocupado) só aparece como erro: o
// navegador não conta o status da resposta.
export function openSocket(url: string, timeoutMs = 15_000): Promise<Link> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    let opened = false;
    const messageListeners: ((d: Uint8Array) => void)[] = [];
    const closeListeners: (() => void)[] = [];
    const timer = setTimeout(() => {
      if (!opened) {
        ws.close();
        reject(new SocketClosed(0));
      }
    }, timeoutMs);
    ws.onopen = () => {
      opened = true;
      clearTimeout(timer);
      resolve({
        send: (d) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(d as Uint8Array<ArrayBuffer>);
        },
        onMessage: (cb) => void messageListeners.push(cb),
        onClose: (cb) => void closeListeners.push(cb),
        close: () => ws.close(),
      });
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) for (const cb of messageListeners) cb(new Uint8Array(e.data));
    };
    let closedOnce = false;
    ws.onclose = (e) => {
      clearTimeout(timer);
      if (!opened) return reject(new SocketClosed(e.code));
      if (closedOnce) return;
      closedOnce = true;
      for (const cb of closeListeners) cb();
    };
    ws.onerror = () => {
      // O close vem logo depois.
    };
  });
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return tr('Navegador', 'Browser');
}

function pairFailure(err: unknown): string {
  if (err instanceof HandshakeError) {
    if (err.reason === 'wrong-code') return tr('Código errado. Gere um código novo no computador e tente de novo.', 'Wrong code. Generate a new code on the computer and try again.');
    if (err.reason === 'closed') return tr('O computador não respondeu a tempo. Gere um código novo.', 'The computer did not answer in time. Generate a new code.');
    return tr('O computador respondeu fora do esperado.', 'The computer answered unexpectedly.');
  }
  if (err instanceof SocketClosed)
    return tr(
      'Nenhum pareamento esperando com esse código. Confira o código ou gere outro no computador.',
      'No pairing is waiting with that code. Check it or generate another one on the computer.',
    );
  return err instanceof Error ? err.message : String(err);
}

// Pareia com o código do computador (Configurações > Acesso remoto). Erro em texto, ou nulo.
export async function pairWithCode(text: string): Promise<string | null> {
  const code = parsePairCode(text);
  if (!code) return tr('O código tem 5 letras e números, um hífen e 6 números, como K7Q4M-913776.', 'The code has 5 letters and digits, a hyphen and 6 digits, like K7Q4M-913776.');
  let raw: Link;
  try {
    raw = await openSocket(`${relayBase()}/pair/${code.nameplate}?role=client`);
  } catch (err) {
    return pairFailure(err);
  }
  try {
    const granted = await pairAsClient(raw, code, deviceName());
    savePairedHost({ hostId: granted.hostId, hostName: granted.hostName, deviceId: granted.deviceId, psk: b64(granted.psk) });
    return null;
  } catch (err) {
    return pairFailure(err);
  } finally {
    raw.close();
  }
}

export function forgetPairedHost(): void {
  savePairedHost(null);
  clearCache();
}
