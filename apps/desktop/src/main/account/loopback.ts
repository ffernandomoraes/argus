import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

// Espera a volta do login no navegador. O servidor da conta manda o navegador para
// http://127.0.0.1:<porta>/callback com ?code=... (ou ?error=...). A porta é sorteada pelo sistema e
// só escuta neste computador (127.0.0.1): no Windows e no Mac, isso não abre aviso de firewall.

export type LoginCallback = { code: string } | { error: 'denied' | 'error' };

export type Loopback = {
  port: number
  // A volta do navegador.
  result: Promise<LoginCallback>
  // Manda o navegador para a página final (no servidor da conta) e fecha.
  finish(location: string): void
  close(): void
};

export async function openLoopback(): Promise<Loopback> {
  let port = 0;
  let resolve!: (r: LoginCallback) => void;
  const result = new Promise<LoginCallback>((r) => (resolve = r));
  let waiting: ServerResponse | null = null;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    // Só o endereço da volta, por esse nome: outro site não chega aqui por outro nome (DNS rebinding).
    const ours = req.method === 'GET' && url.pathname === '/callback' && req.headers.host === `127.0.0.1:${port}`;
    if (!ours || waiting) {
      res.writeHead(404).end();
      return;
    }
    waiting = res;
    const code = url.searchParams.get('code');
    resolve(code && /^[A-Za-z0-9_-]{43}$/.test(code) ? { code } : { error: url.searchParams.get('error') === 'denied' ? 'denied' : 'error' });
  });

  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => ok());
  });
  port = (server.address() as AddressInfo).port;

  const close = () => {
    waiting?.writeHead(204).end();
    waiting = null;
    server.close();
    server.closeAllConnections();
  };

  return {
    port,
    result,
    finish(location) {
      waiting?.writeHead(302, { location, 'cache-control': 'no-store' }).end();
      waiting = null;
      close();
    },
    close,
  };
}
