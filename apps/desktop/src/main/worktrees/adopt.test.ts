import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { adoptWorktree } from './adopt';

const ID = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];
const run = (cwd: string, ...args: string[]) => execFileSync('git', [...ID, ...args], { cwd, stdio: 'pipe' }).toString();

function commit(cwd: string, file: string): void {
  writeFileSync(join(cwd, file), file);
  run(cwd, 'add', file);
  run(cwd, 'commit', '-m', file);
}

// Remoto com a main; o clone tem a branch "feature" (1 commit) e a main do remoto andou 2 commits
// depois que a feature saiu, como na pasta principal do saycents.
let repo = '';
beforeAll(() => {
  const root = join(process.env.HOME ?? '', 'adopt');
  const seed = join(root, 'seed');
  mkdirSync(seed, { recursive: true });
  run(seed, 'init', '-b', 'main');
  commit(seed, 'a.txt');
  run(root, 'clone', '--bare', seed, 'remote.git');
  repo = join(root, 'repo');
  run(root, 'clone', join(root, 'remote.git'), 'repo');
  run(repo, 'checkout', '-b', 'feature');
  commit(repo, 'feature.txt');
  run(seed, 'remote', 'add', 'origin', join(root, 'remote.git'));
  commit(seed, 'b.txt');
  commit(seed, 'c.txt');
  run(seed, 'push', 'origin', 'main');
  run(repo, 'fetch', 'origin');
});

describe('adoptWorktree', () => {
  // 2026-11-16: o Claude cria o worktree a partir de origin/<padrão> (worktree.baseRef "fresh"), e a
  // base gravada era a branch da pasta de origem: a contagem somava o que a main tinha a mais.
  it('worktree criado da branch padrão do remoto: base é ela, não a da pasta', async () => {
    const wt = join(repo, '..', 'wt-fresh');
    run(repo, 'worktree', 'add', '-b', 'claude/fresh', wt, 'origin/main');
    expect(await adoptWorktree(wt, repo)).toMatchObject({ ok: true, base: 'main' });
  });

  it('worktree criado do HEAD local (worktree.baseRef "head"): base é a branch da pasta', async () => {
    const wt = join(repo, '..', 'wt-head');
    run(repo, 'worktree', 'add', '-b', 'claude/head', wt, 'HEAD');
    commit(wt, 'work.txt');
    expect(await adoptWorktree(wt, repo)).toMatchObject({ ok: true, base: 'feature' });
  });
});
