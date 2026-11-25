import { describe, expect, it } from 'vitest';
import { hintCloneUrl, importNodes, isSafeFolderPath, localPath, normalizeRemote, portablePath, readBoardSummaries, remapNodes, snapshotFolders, snapshotNodes, summarizeBoard } from './accountWorkspaces';

const same = (p: string) => p;

describe('snapshotNodes', () => {
  it('keeps groups, folder cards and notes, without machine-only fields', () => {
    const nodes = [
      { id: 'g', type: 'area', position: { x: 0, y: 0 }, width: 400, selected: true, data: { label: 'Work', color: 'blue', account: 'acc-1', autoGrownFrom: { width: 1, height: 1 } } },
      { id: 'p', type: 'project', parentId: 'g', position: { x: 1, y: 2 }, data: { name: 'argus', path: '~\\code\\argus', color: 'red' } },
      { id: 'n', type: 'note', position: { x: 3, y: 4 }, data: { text: 'hi', color: 'yellow' } },
      { id: 't', type: 'terminal', position: { x: 0, y: 0 }, data: { name: 'x', path: '~/x' } },
      { id: 'c', type: 'chat', position: { x: 0, y: 0 }, data: { name: 'x', path: '~/x', sessionId: 's' } },
      { id: 'w', type: 'project', position: { x: 0, y: 0 }, data: { name: 'task', path: '~/.argus/worktrees/a/b', color: 'red', worktree: { of: 'p', base: 'main' } } },
    ];
    const out = snapshotNodes(nodes, portablePath) as Record<string, unknown>[];
    expect(out.map((n) => n.id)).toEqual(['g', 'p', 'n']);
    expect(out[0]).toEqual({ id: 'g', type: 'area', position: { x: 0, y: 0 }, width: 400, data: { label: 'Work', color: 'blue' } });
    expect((out[1].data as { path: string }).path).toBe('~/code/argus');
  });

  it('drops a block whose group did not go', () => {
    const nodes = [{ id: 'n', type: 'note', parentId: 'gone', position: { x: 0, y: 0 }, data: { text: 'a', color: 'y' } }];
    expect(snapshotNodes(nodes, same)).toEqual([]);
  });

  it('makes the folders of a multi-folder card portable', () => {
    const nodes = [{ id: 'p', type: 'project', position: { x: 0, y: 0 }, data: { name: 'ws', path: '/data/workspaces/1', color: 'c', folders: ['~\\a', '~/b'] } }];
    const out = snapshotNodes(nodes, portablePath);
    expect(snapshotFolders(out)).toEqual(['~/a', '~/b']);
  });
});

describe('paths', () => {
  it('converts between portable and local paths', () => {
    expect(portablePath('~\\Desktop\\proj')).toBe('~/Desktop/proj');
    expect(portablePath('/opt/x')).toBe('/opt/x');
    expect(localPath('~/Desktop/proj', true)).toBe('~\\Desktop\\proj');
    expect(localPath('~/Desktop/proj', false)).toBe('~/Desktop/proj');
    expect(localPath('D:\\code', true)).toBe('D:\\code');
  });

  it('normalizes git remotes', () => {
    expect(normalizeRemote('git@github.com:Ana/Argus.git')).toBe('github.com/ana/argus');
    expect(normalizeRemote('https://github.com/ana/argus')).toBe('github.com/ana/argus');
    expect(normalizeRemote('https://user:token@github.com/ana/argus.git/')).toBe('github.com/ana/argus');
    expect(normalizeRemote('ssh://git@gitlab.com:22/team/app.git')).toBe('gitlab.com/team/app');
    expect(normalizeRemote('nonsense')).toBeNull();
  });
});

describe('remapNodes', () => {
  it('gives new ids, keeps the group link and swaps the folders found here', () => {
    const nodes = [
      { id: 'g', type: 'area', position: { x: 0, y: 0 }, data: { label: 'W', color: 'b' } },
      { id: 'p', type: 'project', parentId: 'g', position: { x: 0, y: 0 }, data: { name: 'a', path: '~/a', color: 'r' } },
      { id: 'q', type: 'project', position: { x: 0, y: 0 }, data: { name: 'b', path: '~/b', color: 'r' } },
    ];
    const r = remapNodes(nodes, (id) => `new-${id}`, (p) => (p === '~/a' ? '~/code/a' : null));
    expect(r.nodes.map((n) => n.id)).toEqual(['new-g', 'new-p', 'new-q']);
    expect(r.nodes[1].parentId).toBe('new-g');
    expect(r.nodes[1].data).toMatchObject({ path: '~/code/a' });
    expect(r.nodes[2].data).toMatchObject({ path: '~/b' });
    expect('parentId' in r.nodes[2]).toBe(false);
    expect(r).toMatchObject({ found: 1, missing: 1 });
  });
});

describe('summarizeBoard', () => {
  it('counts folders, groups and notes', () => {
    const nodes = [
      { id: 'g', type: 'area', data: {} },
      { id: 'p', type: 'project', data: { path: '~/a' } },
      { id: 'q', type: 'project', data: { path: '~/a' } },
      { id: 'n', type: 'note', data: {} },
    ];
    expect(summarizeBoard({ id: 'b', name: 'B', nodes })).toEqual({ id: 'b', name: 'B', folders: 1, groups: 1, notes: 1 });
  });
});

describe('cloneUrl', () => {
  it('drops credentials and refuses what is not a clone address', async () => {
    const { cloneUrl } = await import('./accountWorkspaces');
    expect(cloneUrl('https://ana:ghp_secret@github.com/ana/argus.git')).toBe('https://github.com/ana/argus.git');
    expect(cloneUrl('git@github.com:ana/argus.git')).toBe('git@github.com:ana/argus.git');
    expect(cloneUrl('ssh://git@gitlab.com:22/team/app.git')).toBe('ssh://git@gitlab.com:22/team/app.git');
    expect(cloneUrl('/Users/ana/repo')).toBeNull();
    expect(cloneUrl('file:///etc')).toBeNull();
  });
});

describe('o que vem de outro computador', () => {
  it('accepts normal folders and the WSL ones, refuses network paths, control characters and ..', () => {
    for (const ok of ['~/code/argus', '/Users/ana/x', 'C:\\Users\\ana\\x', '\\\\wsl.localhost\\Ubuntu\\home\\ana', '\\\\wsl$\\Debian\\x', '~/👨‍💻 projetos']) {
      expect(isSafeFolderPath(ok), ok).toBe(true);
    }
    for (const bad of ['\\\\atacante\\pasta', '//atacante/pasta', '\\\\?\\UNC\\x\\y', 'smb://x/y', 'file:///etc', '/net/x/y', '/Network/Servers/x', '~/a\n# texto', '~/a\u0000', '~/a/../../etc', '~/\u202Egpj.exe', '', 'x'.repeat(1025), 42]) {
      expect(isSafeFolderPath(bad), String(bad)).toBe(false);
    }
  });

  it('keeps only groups, folder cards and notes, with safe paths and plain measures', () => {
    const nodes = importNodes([
      { id: 't', type: 'terminal', position: { x: 0, y: 0 }, data: { path: '~/a' } },
      { id: 'g', type: 'area', position: { x: 1, y: 2 }, style: { width: 10, background: 'url(https://x)' }, data: { label: 'G' } },
      { id: 'p', type: 'project', parentId: 'g', position: { x: 0, y: 0 }, data: { name: 'a', path: '~/a' } },
      { id: 'w', type: 'project', position: { x: 0, y: 0 }, data: { name: 'w', path: '/ws/1', folders: ['~/a', '\\\\x\\y'] } },
      { id: 'u', type: 'project', position: { x: 0, y: 0 }, data: { name: 'u', path: '\\\\x\\y' } },
      { id: 'z', type: 'project', position: { x: 0, y: 0 }, data: { name: 'z', path: '/ws/2', folders: ['//x/y'] } },
      { id: 'n', type: 'note', parentId: 'u', position: { x: 0, y: 0 }, data: { text: 'órfã' } },
    ]) as { id: string; style?: unknown; data: { folders?: string[] } }[];
    expect(nodes.map((n) => n.id)).toEqual(['g', 'p', 'w']);
    expect(nodes[0]!.style).toEqual({ width: 10 });
    expect(nodes[2]!.data.folders).toEqual(['~/a']);
  });

  it('builds the clone address only from trusted hints', () => {
    expect(hintCloneUrl({ url: 'https://ana:x@github.com/ana/a.git' })).toBe('https://github.com/ana/a.git');
    expect(hintCloneUrl({ remote: 'github.com/ana/a' })).toBe('https://github.com/ana/a.git');
    expect(hintCloneUrl({ url: 'ext::sh -c x', remote: 'evil host/x' })).toBeNull();
    expect(hintCloneUrl(undefined)).toBeNull();
  });

  it('reads the summaries of the list', () => {
    expect(readBoardSummaries([{ id: 'a', name: 'A', folders: 2, groups: -1, notes: 'x' }, { id: 1 }, null])).toEqual([
      { id: 'a', name: 'A', folders: 2, groups: 0, notes: 0 },
    ]);
    expect(readBoardSummaries('x')).toEqual([]);
  });
});
