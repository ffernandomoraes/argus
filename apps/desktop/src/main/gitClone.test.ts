import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cloneRepository, tokenEnv } from './gitClone';

// O "Clonar…" do card: recusa o que não é endereço de clone, nome de pasta estranho e pasta que já
// existe, sem rodar o git.

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'argus-clone-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('cloneRepository', () => {
  it('refuses local paths, option-like names and folders that exist', async () => {
    expect(await cloneRepository('/etc', dir, 'x')).toMatchObject({ ok: false });
    expect(await cloneRepository('https://github.com/a/b.git', dir, '--upload-pack=evil')).toMatchObject({ ok: false });
    expect(await cloneRepository('https://github.com/a/b.git', dir, '../b')).toMatchObject({ ok: false });
    mkdirSync(join(dir, 'b'));
    const r = await cloneRepository('https://github.com/a/b.git', dir, 'b');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/b/);
  });
});

describe('tokenEnv', () => {
  it('adds the github.com header after the config already in the environment', () => {
    const env = tokenEnv('ghu_x', { GIT_CONFIG_COUNT: '2' });
    expect(env.GIT_CONFIG_COUNT).toBe('3');
    expect(env.GIT_CONFIG_KEY_2).toBe('http.https://github.com/.extraheader');
    expect(Buffer.from(String(env.GIT_CONFIG_VALUE_2).replace('AUTHORIZATION: basic ', ''), 'base64').toString()).toBe('x-access-token:ghu_x');
    expect(tokenEnv('t', {}).GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader');
  });
});
