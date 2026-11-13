// Store externo pequeno: um valor, quem quer saber quando ele muda e nada mais. Substitui os
// stores feitos à mão (variável solta + Set de ouvintes + contador de versão). Na tela, lê-se com
// `useStore` (./useStore), que redesenha só quando o pedaço escolhido muda.
//
// O valor é tratado como imutável: para mudar um Map, uma lista ou um objeto, crie um novo
// (`set((prev) => new Map(prev).set(chave, valor))`). Mexer no objeto atual não avisa ninguém.

export type ReadableStore<T> = {
  get(): T
  // Referência fixa: pode ir direto para o useSyncExternalStore, sem refazer a inscrição.
  subscribe(listener: () => void): () => void
}

export type Store<T> = ReadableStore<T> & {
  // Valor novo, ou função que recebe o atual e devolve o novo. Igual ao atual (Object.is), não
  // avisa ninguém. Por isso T não pode ser uma função: ela seria lida como atualização.
  set(next: T | ((prev: T) => T)): void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (next) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      if (Object.is(value, state)) return
      state = value
      // Cópia: quem sai ou entra durante o aviso não bagunça a volta.
      for (const listener of [...listeners]) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
