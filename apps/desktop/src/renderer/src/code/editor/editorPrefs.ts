import { createStore } from '../../lib/createStore';
import { useStore } from '../../lib/useStore';

// Quebra de linha do editor de código (⌥Z): vale para todos os arquivos e fica lembrada nesta
// máquina. Sem acesso ao armazenamento (janela privada, teste), começa desligada.
const KEY = 'argus.codeEditor.wrap';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

const wrap = createStore(read());

export const getWrap = (): boolean => wrap.get();

export function toggleWrap(): void {
  const next = !wrap.get();
  wrap.set(next);
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    // Só não fica lembrada.
  }
}

export const useWrap = (): boolean => useStore(wrap);
