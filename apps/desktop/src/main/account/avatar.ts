import { readBody } from './http';

// A foto do perfil, baixada aqui e guardada como data: (a janela só mostra imagens locais: ver a
// política de imagens em electron.vite.config.ts). Só dos endereços de foto do GitHub e do Google,
// sem seguir redirecionamento (que levaria para outro endereço).

const HOSTS = [/^avatars\.githubusercontent\.com$/, /^[a-z0-9-]+\.googleusercontent\.com$/];
const TYPES = /^image\/(png|jpeg|gif|webp)$/;
const MAX_BYTES = 512 * 1024;

export function isAvatarUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

// Nula: sem foto, endereço estranho ou não deu para baixar (a tela mostra as iniciais).
export async function downloadAvatar(url: unknown): Promise<string | null> {
  if (!isAvatarUrl(url)) return null;
  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!res.ok || !TYPES.test(type)) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    const bytes = await readBody(res, MAX_BYTES);
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}
