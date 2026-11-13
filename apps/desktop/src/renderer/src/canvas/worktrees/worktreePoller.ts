// Quando a faixa do card do worktree pergunta a situação ao processo principal. Cada pergunta roda
// git (no WSL, cada git é um wsl.exe), então segue as regras da extensão git do VS Code
// (extensions/git/src/repository.ts): lê por aviso de mudança, não por relógio; espera as mudanças
// pararem um instante; deixa um intervalo mínimo entre leituras; e não lê com a janela sem foco.
// Antes era a cada 2 s com conversa rodando, e na hora a cada resposta: com tarefas em paralelo no
// WSL, a digitação ficava lenta (2026-11-03).

// Mudança avisada: espera este tanto sem outra antes de ler (o VS Code espera 1 s).
export const SETTLE_MS = 1000;
// Entre o fim de uma leitura e o começo da próxima (o VS Code espera 5 s).
export const GAP_MS = 5000;
// Sem aviso nenhum: push, fetch e a branch renomeada não mexem nos arquivos que avisam.
export const SAFETY_MS = 60_000;
// Preparando (criando a pasta, instalando dependências) ou antes da primeira resposta: a leitura não
// roda git, e a faixa precisa ver logo quando fica pronta.
export const FAST_MS = 2000;

export type PollerDeps = {
  read: () => Promise<unknown>
  // Preparando ou sem resposta ainda: relê de FAST_MS em FAST_MS, com ou sem foco.
  fast: () => boolean
  active: () => boolean
  onActive: (fn: () => void) => () => void
};

export type WorktreePoller = { changed: () => void; stop: () => void };

export function createWorktreePoller(deps: PollerDeps): WorktreePoller {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reading = false;
  // Mudança avisada no meio de uma leitura: outra depois do intervalo.
  let dirty = false;
  // Hora de ler chegou com a janela sem foco: lê quando alguém voltar.
  let waitingFocus = false;
  let lastEnd = Number.NEGATIVE_INFINITY;

  const at = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(run, Math.max(0, ms));
  };
  const sinceGap = () => lastEnd + GAP_MS - Date.now();

  const canRead = () => deps.fast() || deps.active();

  function run(): void {
    timer = undefined;
    if (stopped || reading) return;
    if (!canRead()) {
      waitingFocus = true;
      return;
    }
    reading = true;
    dirty = false;
    deps
      .read()
      .catch(() => {})
      .finally(() => {
        reading = false;
        lastEnd = Date.now();
        if (stopped) return;
        if (dirty) at(GAP_MS);
        else at(deps.fast() ? FAST_MS : SAFETY_MS);
      });
  }

  const offActive = deps.onActive(() => {
    if (stopped || !waitingFocus) return;
    waitingFocus = false;
    at(sinceGap());
  });

  run();

  return {
    changed() {
      if (stopped) return;
      if (reading) {
        dirty = true;
        return;
      }
      if (!canRead()) {
        clearTimeout(timer);
        timer = undefined;
        waitingFocus = true;
        return;
      }
      at(Math.max(SETTLE_MS, sinceGap()));
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      offActive();
    },
  };
}
