import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadAvatar, isAvatarUrl } from './avatar';

// A foto do perfil: só dos endereços de foto do GitHub e do Google, sem redirecionamento.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadAvatar', () => {
  it('accepts only GitHub and Google photo addresses', () => {
    expect(isAvatarUrl('https://avatars.githubusercontent.com/u/1?v=4')).toBe(true);
    expect(isAvatarUrl('https://lh3.googleusercontent.com/a/x=s96-c')).toBe(true);
    expect(isAvatarUrl('http://avatars.githubusercontent.com/u/1')).toBe(false);
    expect(isAvatarUrl('https://avatars.githubusercontent.com.evil.dev/u/1')).toBe(false);
    expect(isAvatarUrl('https://avatars.githubusercontent.com:8443/u/1')).toBe(false);
    expect(isAvatarUrl('file:///etc/passwd')).toBe(false);
  });

  it('does not follow redirects and refuses what is not an image', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response('<html>', { headers: { 'content-type': 'text/html' } });
    });
    expect(await downloadAvatar('https://avatars.githubusercontent.com/u/1')).toBeNull();
    expect(calls[0]?.redirect).toBe('error');
  });

  it('keeps a small image as data:', async () => {
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    expect(await downloadAvatar('https://avatars.githubusercontent.com/u/1')).toBe('data:image/png;base64,AQID');
  });
});
