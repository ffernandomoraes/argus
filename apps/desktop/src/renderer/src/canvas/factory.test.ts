import { describe, expect, it } from 'vitest';
import { createFolderInstance, createWorktreeNode, findFolderNode } from './factory';

describe('findFolderNode', () => {
  const folder = createFolderInstance({ x: 0, y: 0 }, '/tmp/gestão'.normalize('NFD'));

  it('finds the folder already on the canvas', () => {
    expect(findFolderNode([folder], '/tmp/gestão'.normalize('NFD'))?.id).toBe(folder.id);
  });

  // O seletor do macOS entrega NFD e o Claude Code grava NFC: é a mesma pasta.
  it('treats decomposed and composed accents as the same folder', () => {
    expect(findFolderNode([folder], '/tmp/gestão'.normalize('NFC'))?.id).toBe(folder.id);
  });

  it('ignores worktrees and other folders', () => {
    const worktree = createWorktreeNode('/tmp/other', 'task', { of: folder.id } as never);
    expect(findFolderNode([worktree], '/tmp/other')).toBeUndefined();
    expect(findFolderNode([folder], '/tmp/gestao')).toBeUndefined();
  });
});
