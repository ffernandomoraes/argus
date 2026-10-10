import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ReadableStore } from './createStore'

// Lê um store (createStore) na tela. Sem seletor, devolve o valor inteiro. Com seletor, redesenha
// só quando o pedaço escolhido muda: o seletor pode montar um objeto ou lista nova a cada leitura
// sem entrar em laço, e com `isEqual` (ex.: shallowEqual) devolve a mesma referência de antes
// enquanto o pedaço for igual, o que mantém os memo e as dependências de efeito quietos.
//
// É um hook solto, e não um método do store, de propósito: o React Compiler trata `store.use()`
// como chamada comum e pode guardá-la em cache, pulando o hook de dentro; `useStore` ele e o
// ESLint reconhecem como hook.
export function useStore<T>(store: ReadableStore<T>): T
export function useStore<T, S>(store: ReadableStore<T>, selector: (state: T) => S, isEqual?: (a: S, b: S) => boolean): S
export function useStore<T, S>(store: ReadableStore<T>, selector?: (state: T) => S, isEqual?: (a: S, b: S) => boolean): S {
  const [cell] = useState(newCell)
  const getSnapshot = useMemo(
    () => selectFrom(cell, store, selector ?? (identity as (state: T) => S), isEqual ?? Object.is),
    [cell, store, selector, isEqual]
  )
  return useSyncExternalStore(store.subscribe, getSnapshot)
}

// Última leitura desta instância do hook: com o mesmo valor do store e o mesmo seletor, devolve o
// que já tinha; com seletor novo (função criada no render), compara o resultado com `isEqual`.
type Cell = { filled: boolean; state: unknown; selector: unknown; value: unknown }

const newCell = (): Cell => ({ filled: false, state: undefined, selector: undefined, value: undefined })

const identity = <T>(state: T): T => state

// Fora do hook de propósito: a célula só muda aqui, quando o React pede o valor. Escrita assim
// dentro do corpo do hook, o React Compiler recusaria otimizar o componente.
function selectFrom<T, S>(
  cell: Cell,
  store: ReadableStore<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean
): () => S {
  return () => {
    const state = store.get()
    if (cell.filled && cell.selector === selector && Object.is(cell.state, state)) return cell.value as S
    const next = selector(state)
    const same = cell.filled && isEqual(cell.value as S, next)
    cell.filled = true
    cell.state = state
    cell.selector = selector
    if (!same) cell.value = next
    return cell.value as S
  }
}
