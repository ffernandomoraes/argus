import { describe, expect, it } from 'vitest';
import { countMatches, findMatches, foldQuery } from './textSearch';

describe('findMatches', () => {
  it('não diferencia maiúsculas nem acentos', () => {
    expect(findMatches('O Histórico e o historico', 'HISTÓRICO')).toEqual([
      [2, 11],
      [16, 25],
    ]);
  });

  it('acento decomposto (NFD) volta às posições originais', () => {
    // "ó" decomposto vira duas letras: o "o" e o acento solto.
    const text = 'abc história fim'.normalize('NFD');
    const [[start, end]] = findMatches(text, 'historia');
    expect(text.slice(start, end).normalize('NFC')).toBe('história');
  });

  it('não sobrepõe ocorrências', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it('termo vazio ou só espaços não acha nada', () => {
    expect(findMatches('texto', '')).toEqual([]);
    expect(findMatches('texto', '   ')).toEqual([]);
  });
});

describe('countMatches', () => {
  it('conta como o findMatches', () => {
    const text = 'Ação, acao e AÇÃO';
    expect(countMatches(text, foldQuery('acao'))).toBe(findMatches(text, 'acao').length);
    expect(countMatches(text, foldQuery('acao'))).toBe(3);
  });
});
