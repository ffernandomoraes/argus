import type { ClaudeModel } from '@argus/shared/models';

// A lista de modelos do menu vem do "catálogo servido": o `claude` busca no servidor ao abrir e guarda
// em <pasta da conta>/cache/model-catalog. Sem catálogo guardado (conta nova, pasta limpa), o `claude -p`
// espera a resposta por só 1,5 s; passou disso, responde ao "init" com a lista reduzida do próprio
// binário: uma linha por família, sem versão no nome ("Opus", "Fable", "Sonnet", "Haiku"), sem as
// versões anteriores. A busca segue em segundo plano e grava o catálogo se o processo ainda estiver
// aberto. Conferido no binário da 2.1.323 e reproduzido com um proxy que atrasava 3 s cada conexão
// (2026-11-17, relato de um Windows: o menu só com "Fable", sem 5.2 nem 5.1).
// Como o Argus perguntava uma vez só e fechava o `claude` ao responder, a lista reduzida ficava no
// menu até o app reabrir (ou a pessoa entrar de novo na conta), e a busca morria antes de gravar.

const ALIASES = new Set(['opus', 'sonnet', 'haiku', 'fable']);

// Lista reduzida: o atalho de uma família veio sem a versão no nome ("Fable" em vez de "Fable 5.2").
export function isReducedModelList(models: ClaudeModel[]): boolean {
  return models.some((m) => ALIASES.has(m.value) && !/\d/.test(m.displayName));
}

// Com a lista reduzida, o `claude` de uma vez só fica aberto este tempo antes de fechar, para a busca
// do catálogo terminar e gravar.
export const MODEL_GRACE_MS = 15_000;
// Depois pergunta de novo, a um `claude` novo (o catálogo vale para o processo inteiro). Poucas vezes:
// conta sem catálogo servido (chave de API, gateway) tem sempre a lista reduzida.
const RETRY_MS = [30_000, 3 * 60_000, 15 * 60_000];

export type ModelRetry = {
  // Chegou uma lista. Reduzida: marca a próxima pergunta, se ainda há tentativas. Devolve se é reduzida.
  check(models: ClaudeModel[]): boolean
  // Monitor parado ou conta trocada: nada marcado, tentativas do início.
  reset(): void
};

export function createModelRetry(askAgain: () => void): ModelRetry {
  let attempts = 0;
  let timer: NodeJS.Timeout | null = null;
  const clear = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    check(models) {
      if (!isReducedModelList(models)) {
        attempts = 0;
        clear();
        return false;
      }
      if (!timer && attempts < RETRY_MS.length) {
        timer = setTimeout(() => {
          timer = null;
          askAgain();
        }, RETRY_MS[attempts++]);
      }
      return true;
    },
    reset() {
      attempts = 0;
      clear();
    },
  };
}
