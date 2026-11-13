import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorktreePoller, FAST_MS, GAP_MS, SAFETY_MS, SETTLE_MS, type WorktreePoller } from './worktreePoller';

// 2026-11-03: digitação lenta no Windows com WSL e tarefas em paralelo. A faixa de cada worktree
// perguntava a situação a cada 2 s com conversa rodando e na hora a cada resposta, e cada pergunta
// rodava de quatro a seis git (um wsl.exe cada). As regras novas são as do VS Code.

let reads = 0;
let active = true;
let fast = false;
let focusBack: (() => void) | null = null;
let poller: WorktreePoller;

const start = () =>
  (poller = createWorktreePoller({
    read: async () => {
      reads++;
    },
    fast: () => fast,
    active: () => active,
    onActive: (fn) => {
      focusBack = fn;
      return () => {
        focusBack = null;
      };
    },
  }));

// Deixa o tempo andar e a leitura em andamento terminar.
const wait = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  reads = 0;
  active = true;
  fast = false;
});

afterEach(() => {
  poller.stop();
  vi.useRealTimers();
});

describe('createWorktreePoller', () => {
  it('lê ao montar e, sem aviso, só na conferência de segurança', async () => {
    start();
    await wait(0);
    expect(reads).toBe(1);
    await wait(SAFETY_MS - 1);
    expect(reads).toBe(1);
    await wait(1);
    expect(reads).toBe(2);
  });

  it('vários avisos seguidos viram uma leitura, com o intervalo mínimo entre elas', async () => {
    start();
    await wait(0);
    for (let i = 0; i < 10; i++) {
      poller.changed();
      await wait(200);
    }
    // O último aviso foi há 200 ms: ainda esperando as mudanças pararem.
    expect(reads).toBe(1);
    await wait(GAP_MS);
    expect(reads).toBe(2);
    // Aviso logo depois de uma leitura espera o intervalo inteiro, não só o instante de calma.
    poller.changed();
    await wait(SETTLE_MS);
    expect(reads).toBe(2);
    await wait(GAP_MS - SETTLE_MS);
    expect(reads).toBe(3);
  });

  it('aviso no meio de uma leitura gera uma só depois dela', async () => {
    let finish = () => {};
    poller = createWorktreePoller({
      read: () => {
        reads++;
        return new Promise<void>((resolve) => (finish = resolve));
      },
      fast: () => false,
      active: () => true,
      onActive: () => () => {},
    });
    poller.changed();
    poller.changed();
    expect(reads).toBe(1);
    finish();
    await wait(GAP_MS - 1);
    expect(reads).toBe(1);
    await wait(1);
    expect(reads).toBe(2);
  });

  it('sem foco não lê; ao voltar o foco, lê o que ficou pendente', async () => {
    start();
    await wait(0);
    active = false;
    poller.changed();
    await wait(SAFETY_MS * 3);
    expect(reads).toBe(1);
    active = true;
    focusBack?.();
    await wait(0);
    expect(reads).toBe(2);
  });

  it('voltar o foco sem nada pendente não lê', async () => {
    start();
    await wait(0);
    focusBack?.();
    await wait(GAP_MS);
    expect(reads).toBe(1);
  });

  it('preparando, relê de perto mesmo sem foco', async () => {
    fast = true;
    active = false;
    poller = createWorktreePoller({
      // A terceira leitura traz o worktree pronto.
      read: async () => {
        reads++;
        if (reads === 3) fast = false;
      },
      fast: () => fast,
      active: () => active,
      onActive: () => () => {},
    });
    await wait(0);
    await wait(FAST_MS);
    await wait(FAST_MS);
    expect(reads).toBe(3);
    // Pronto: a próxima é a de segurança, e sem foco ela espera.
    await wait(SAFETY_MS * 2);
    expect(reads).toBe(3);
  });
});
