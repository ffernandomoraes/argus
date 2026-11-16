// Link para o localhost clicado na janela de acesso remoto: o servidor está no outro computador. A
// porta do link vira a porta daqui do túnel (ver tunnelClient.ts). Lógica pura, testada em
// localhostLink.test.ts.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

// A porta de um link http(s) para este computador; nulo para os outros links.
export function loopbackPort(url: string): number | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!LOOPBACK.has(u.hostname) && !u.hostname.endsWith('.localhost')) return null;
  return u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
}

// O mesmo link, na porta `local` daqui. 0.0.0.0 vira localhost (o navegador não abre 0.0.0.0 em
// todo sistema).
export function onLocalPort(url: string, local: number): string {
  const u = new URL(url);
  if (u.hostname === '0.0.0.0') u.hostname = 'localhost';
  u.port = String(local);
  return u.toString();
}
