import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { worktreeStatus } from './status';
import { rememberWorktree } from './store';

// O git responde daqui, e cada chamada fica contada: o rev-list diz 2 commits sem enviar, a branch
// não está na padrão do remoto (`merged`), o diff com a base traz `diffOut`, o resto volta vazio.
const fake = vi.hoisted(() => ({ merged: false, diffOut: '' }));
const git = vi.hoisted(() =>
  vi.fn(async (_cwd: string, args: string[]) => {
    if (args.includes('origin/HEAD')) {
      if (fake.merged) return '';
      throw Object.assign(new Error('not ancestor'), { code: 1 });
    }
    if (args.includes('diff')) return fake.diffOut;
    return args.includes('rev-list') ? '2\n' : '';
  }),
);
vi.mock('../gitBranch/git', async (importOriginal) => ({ ...(await importOriginal<typeof import('../gitBranch/git')>()), git }));

// O git status tem leitura guardada por um instante; os outros comandos são os que se acumulavam.
const counted = () => git.mock.calls.filter(([, args]) => !args.includes('status')).length;

function worktree(): string {
  const dir = mkdtempSync(join(process.env.HOME ?? '', 'tarefa-'));
  mkdirSync(join(dir, '.git'));
  writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/wip/checkout\n');
  rememberWorktree({ path: dir, main: dir, base: 'main' });
  return dir;
}

describe('worktreeStatus', () => {
  // 2026-10-23: a faixa do card perguntava a cada 2 s sem esperar a resposta; com o WSL lento, as
  // perguntas se acumulavam, cada uma com quatro a seis git rodando lá dentro.
  it('quem pergunta no meio de uma leitura espera a mesma, sem rodar o git de novo', async () => {
    const dir = worktree();
    git.mockClear();
    const all = await Promise.all([worktreeStatus(dir), worktreeStatus(dir), worktreeStatus(dir)]);
    expect(all[0]).toMatchObject({ state: 'ready', branch: 'wip/checkout', files: 0, uncommitted: 0, unpushed: 2 });
    expect(all).toEqual([all[0], all[0], all[0]]);
    const once = counted();
    git.mockClear();
    await worktreeStatus(dir);
    // A leitura seguinte, com o HEAD igual, nem roda o que só muda com commit.
    expect(counted()).toBe(0);
    expect(once).toBeGreaterThan(0);
  });

  // 2026-11-03: digitação lenta no Windows com WSL e tarefas em paralelo. Cada git é um wsl.exe, e o
  // diff com a base e os commits sem enviar rodavam a cada leitura (de 2 em 2 s com conversa rodando).
  it('o diff com a base e os commits sem enviar só rodam de novo quando o HEAD muda', async () => {
    const dir = worktree();
    await worktreeStatus(dir);
    git.mockClear();
    await worktreeStatus(dir);
    expect(counted()).toBe(0);

    // Commit no worktree: o git grava o histórico do HEAD.
    mkdirSync(join(dir, '.git', 'logs'), { recursive: true });
    writeFileSync(join(dir, '.git', 'logs', 'HEAD'), 'commit novo\n');
    await worktreeStatus(dir);
    expect(counted()).toBeGreaterThan(0);

    // Troca de branch: o HEAD aponta para outra.
    git.mockClear();
    writeFileSync(join(dir, '.git', 'HEAD'), 'ref: refs/heads/wip/outra\n');
    expect(await worktreeStatus(dir)).toMatchObject({ branch: 'wip/outra' });
    expect(counted()).toBeGreaterThan(0);
  });

  it('push e fetch não mexem no HEAD: passado um minuto, roda de novo', async () => {
    const dir = worktree();
    await worktreeStatus(dir);
    git.mockClear();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 30_000);
    await worktreeStatus(dir);
    expect(counted()).toBe(0);
    clock.mockReturnValue(now + 61_000);
    await worktreeStatus(dir);
    expect(counted()).toBeGreaterThan(0);
    clock.mockRestore();
  });

  // 2026-11-16: branch já mesclada na origin/main mostrava os 64 arquivos do commit dela e
  // "1 commit não enviado" (sem upstream, contava desde a base).
  it('branch já na padrão do remoto: sem arquivos de commit nem commits sem enviar', async () => {
    fake.diffOut = 'a.ts\0b.ts\0';
    try {
      expect(await worktreeStatus(worktree())).toMatchObject({ files: 2, unpushed: 2 });
      fake.merged = true;
      expect(await worktreeStatus(worktree())).toMatchObject({ files: 0, uncommitted: 0, unpushed: 0 });
    } finally {
      fake.merged = false;
      fake.diffOut = '';
    }
  });

  it('pasta que não é tarefa do Argus: nulo, sem git', async () => {
    git.mockClear();
    expect(await worktreeStatus(join(process.env.HOME ?? '', 'outra'))).toBeNull();
    expect(git).not.toHaveBeenCalled();
  });
});
