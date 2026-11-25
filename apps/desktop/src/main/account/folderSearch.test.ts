import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir(), isPackaged: false } }));

const { FolderFinder, gitRemote } = await import('./folderSearch');

// Achar as pastas de um workspace trazido de outro computador, numa pasta do usuário de mentira.

let home: string;
let oldHome: string | undefined;
let oldProfile: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'argus-find-'));
  oldHome = process.env.HOME;
  oldProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  process.env.HOME = oldHome;
  process.env.USERPROFILE = oldProfile;
  rmSync(home, { recursive: true, force: true });
});

const repo = (rel: string, remote?: string) => {
  const dir = join(home, ...rel.split('/'));
  mkdirSync(join(dir, '.git'), { recursive: true });
  if (remote) writeFileSync(join(dir, '.git', 'config'), `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${remote}\n`);
  return dir;
};

const tilde = (rel: string) => (process.platform === 'win32' ? `~\\${rel.split('/').join('\\')}` : `~/${rel}`);

describe('FolderFinder', () => {
  it('keeps the same path when it exists here', async () => {
    repo('code/argus');
    expect(await new FolderFinder().find('~/code/argus', undefined)).toBe(tilde('code/argus'));
  });

  it('finds the same repository under another name', async () => {
    repo('Desktop/projetos/meu-argus', 'git@github.com:ana/argus.git');
    const found = await new FolderFinder().find('~/code/argus', { remote: 'github.com/ana/argus' });
    expect(found).toBe(tilde('Desktop/projetos/meu-argus'));
  });

  it('finds a unique folder with the same name', async () => {
    mkdirSync(join(home, 'Documents', 'site'), { recursive: true });
    expect(await new FolderFinder().find('~/work/site', undefined)).toBe(tilde('Documents/site'));
  });

  it('gives up when the name is ambiguous', async () => {
    mkdirSync(join(home, 'a', 'site'), { recursive: true });
    mkdirSync(join(home, 'b', 'site'), { recursive: true });
    expect(await new FolderFinder().find('~/work/site', undefined)).toBeNull();
  });

  it('reads the origin remote', async () => {
    const dir = repo('x', 'https://github.com/Ana/X.git');
    expect(await gitRemote(dir)).toBe('github.com/ana/x');
    expect(await gitRemote(join(home, 'nothing'))).toBeNull();
  });
});
