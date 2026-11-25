import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Hashes } from '@argus/shared/accountClaude';
import { claudeHash } from './claudeFiles';
import { ClaudeLibrary } from './claudeSync';
import { AccountHttpError } from './http';

// Dois computadores com a mesma conta, um servidor de mentira em memória e uma pasta do usuário
// de mentira para cada um (trocada antes de cada passo).

let root: string;
let oldHome: string | undefined;
let oldProfile: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'argus-lib-'));
  oldHome = process.env.HOME;
  oldProfile = process.env.USERPROFILE;
});

afterEach(() => {
  process.env.HOME = oldHome;
  process.env.USERPROFILE = oldProfile;
  rmSync(root, { recursive: true, force: true });
});

function fakeServer() {
  const files = new Map<string, string>();
  const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T | null> => {
    const b = body as { files?: { path: string; content: string }[]; paths?: string[] };
    if (path === '/api/claude' && method === 'GET') return { files: [...files].map(([p, c]) => ({ path: p, hash: claudeHash(c), size: c.length })) } as T;
    if (path === '/api/claude' && method === 'PUT') b.files!.forEach((f) => files.set(f.path, f.content));
    if (path === '/api/claude/read') return { files: b.paths!.filter((p) => files.has(p)).map((p) => ({ path: p, content: files.get(p) })) } as T;
    if (path === '/api/claude/remove') b.paths!.forEach((p) => files.delete(p));
    return null;
  };
  return { files, request };
}

function computer(name: string, request: ReturnType<typeof fakeServer>['request']) {
  const home = join(root, name);
  mkdirSync(join(home, '.claude'), { recursive: true });
  let known: Hashes = {};
  const lib = new ClaudeLibrary(request, { get: () => known, set: (k) => (known = k) });
  const at = <T>(fn: () => T): T => {
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    return fn();
  };
  const write = (rel: string, content: string) => {
    const path = join(home, '.claude', ...rel.split('/'));
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  };
  const read = (rel: string) => readFileSync(join(home, '.claude', ...rel.split('/')), 'utf8');
  const has = (rel: string) => existsSync(join(home, '.claude', ...rel.split('/')));
  return { refresh: () => at(() => lib.refresh()), act: (a: 'import' | 'keepLocal' | 'remove', k: string[]) => at(() => lib.act(a, k)), write, read, has };
}

describe('ClaudeLibrary', () => {
  it('sends what is here, offers it on the other computer and imports on request', async () => {
    const server = fakeServer();
    const mac = computer('mac', server.request);
    const pc = computer('pc', server.request);
    mac.write('CLAUDE.md', 'regras');
    mac.write('skills/pdf/SKILL.md', 'skill');
    await mac.refresh();
    expect([...server.files.keys()].sort()).toEqual(['CLAUDE.md', 'skills/pdf/SKILL.md']);

    const offered = await pc.refresh();
    expect(offered.map((i) => [i.key, i.status])).toEqual([['CLAUDE.md', 'new'], ['skills/pdf', 'new']]);
    const after = await pc.act('import', ['skills/pdf']);
    expect(pc.read('skills/pdf/SKILL.md')).toBe('skill');
    expect(after.map((i) => [i.key, i.status])).toEqual([['CLAUDE.md', 'new'], ['skills/pdf', 'synced']]);
  });

  it('asks when both changed, and keeps the chosen one', async () => {
    const server = fakeServer();
    const mac = computer('mac', server.request);
    const pc = computer('pc', server.request);
    mac.write('CLAUDE.md', 'v1');
    await mac.refresh();
    await pc.refresh();
    await pc.act('import', ['CLAUDE.md']);
    mac.write('CLAUDE.md', 'mac');
    await mac.refresh();
    pc.write('CLAUDE.md', 'pc');
    const items = await pc.refresh();
    expect(items[0]!.status).toBe('conflict');
    expect(server.files.get('CLAUDE.md')).toBe('mac');
    await pc.act('keepLocal', ['CLAUDE.md']);
    expect(server.files.get('CLAUDE.md')).toBe('pc');
    expect((await mac.refresh())[0]!.status).toBe('updated');
    await mac.act('import', ['CLAUDE.md']);
    expect(mac.read('CLAUDE.md')).toBe('pc');
  });

  it('removing from the account does not come back from the other computer', async () => {
    const server = fakeServer();
    const mac = computer('mac', server.request);
    const pc = computer('pc', server.request);
    mac.write('agents/a.md', 'a');
    await mac.refresh();
    await pc.refresh();
    await pc.act('import', ['agents/a.md']);
    await pc.act('remove', ['agents/a.md']);
    expect(server.files.size).toBe(0);
    expect(await mac.refresh()).toEqual([]);
    expect(server.files.size).toBe(0);
  });
});

describe('server older than the app', () => {
  it('leaves out only the provider the server refuses', async () => {
    const server = fakeServer();
    const strict = async <T>(path: string, method = 'GET', body?: unknown): Promise<T | null> => {
      const b = body as { files?: { path: string }[] };
      if (method === 'PUT' && b.files!.some((f) => f.path.startsWith('codex/'))) throw new AccountHttpError(400, 'invalid path');
      return server.request<T>(path, method, body);
    };
    const mac = computer('mac', strict);
    mac.write('CLAUDE.md', 'regras');
    const codex = join(root, 'mac', '.codex');
    mkdirSync(codex, { recursive: true });
    writeFileSync(join(codex, 'AGENTS.md'), 'codex');
    const items = await mac.refresh();
    expect([...server.files.keys()]).toEqual(['CLAUDE.md']);
    expect(items.map((i) => i.key)).toEqual(['CLAUDE.md']);
  });
});

describe('import from a server that does not follow the list', () => {
  // O servidor devolve no /read o que quiser; o resto segue o servidor de mentira.
  function serverReturning(server: ReturnType<typeof fakeServer>, files: { path: string; content: string }[]) {
    return async <T>(path: string, method = 'GET', body?: unknown): Promise<T | null> =>
      path === '/api/claude/read' ? ({ files } as T) : server.request<T>(path, method, body);
  }

  it('writes only the files of the chosen item', async () => {
    const server = fakeServer();
    const mac = computer('mac', server.request);
    mac.write('CLAUDE.md', 'regras');
    mac.write('skills/pdf/SKILL.md', 'skill');
    mac.write('agents/a.md', 'agente');
    await mac.refresh();
    const pc = computer('pc', serverReturning(server, [
      { path: 'skills/pdf/SKILL.md', content: 'skill' },
      { path: 'CLAUDE.md', content: 'regras' },
      { path: 'agents/a.md', content: 'agente' },
    ]));
    await pc.refresh();
    const after = await pc.act('import', ['skills/pdf']);
    expect(pc.read('skills/pdf/SKILL.md')).toBe('skill');
    expect(pc.has('CLAUDE.md')).toBe(false);
    expect(pc.has('agents/a.md')).toBe(false);
    expect(after.map((i) => [i.key, i.status])).toEqual([['CLAUDE.md', 'new'], ['skills/pdf', 'synced'], ['agents/a.md', 'new']]);
  });

  it('does not write content different from the account list', async () => {
    const server = fakeServer();
    const mac = computer('mac', server.request);
    mac.write('skills/pdf/SKILL.md', 'skill');
    await mac.refresh();
    const pc = computer('pc', serverReturning(server, [{ path: 'skills/pdf/SKILL.md', content: 'trocado no caminho' }]));
    await pc.refresh();
    const after = await pc.act('import', ['skills/pdf']);
    expect(pc.has('skills/pdf/SKILL.md')).toBe(false);
    expect(after.map((i) => [i.key, i.status])).toEqual([['skills/pdf', 'new']]);
  });
});
