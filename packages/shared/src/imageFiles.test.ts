import { describe, expect, it } from 'vitest';
import type { Message } from './history';
import { localImagePath, markdownTargets, mentionsImage } from './imageFiles';

const read = (detail: string): Message => ({ id: 't', role: 'tool', name: 'Read', label: 'Ler', input: 'print', detail, result: '' });
const answer = (text: string): Message => ({ id: 'a', role: 'assistant', text });

describe('localImagePath', () => {
  it('caminho local de imagem', () => {
    expect(localImagePath('/tmp/print.png')).toBe('/tmp/print.png');
    expect(localImagePath('shots/a.JPG')).toBe('shots/a.JPG');
    expect(localImagePath('C:\\Users\\a\\print.png')).toBe('C:\\Users\\a\\print.png');
  });

  it('tira file://, o #trecho e decodifica', () => {
    expect(localImagePath('file:///tmp/meu%20print.png#x')).toBe('/tmp/meu print.png');
    expect(localImagePath('file:///C:/proj/a.png')).toBe('C:/proj/a.png');
    expect(localImagePath('<shots/a b.png>')).toBe('shots/a b.png');
  });

  it('endereço da web e arquivo que não é imagem ficam de fora', () => {
    expect(localImagePath('https://site.com/a.png')).toBeNull();
    expect(localImagePath('data:image/png;base64,AAA')).toBeNull();
    expect(localImagePath('/tmp/notas.md')).toBeNull();
  });
});

describe('markdownTargets', () => {
  it('links e imagens, com e sem <>', () => {
    expect(markdownTargets('veja ![print](/tmp/a.png "t") e [b](<x y.png>) e [c](https://s.com)')).toEqual(['/tmp/a.png', '<x y.png>', 'https://s.com']);
  });
});

describe('mentionsImage', () => {
  it('imagem que o Claude leu', () => {
    expect(mentionsImage([read('/tmp/print.png')], '/tmp/print.png')).toBe(true);
  });

  it('imagem citada na resposta, mesmo com o endereço codificado', () => {
    expect(mentionsImage([answer('Pronto: ![print](/tmp/meu%20print.png)')], '/tmp/meu print.png')).toBe(true);
  });

  it('caminho que não aparece na conversa não passa', () => {
    expect(mentionsImage([read('/tmp/print.png'), answer('ver /Users/a/foto.png')], '/Users/a/foto.png')).toBe(false);
    expect(mentionsImage([answer('[a](/tmp/x/print.png)')], 'print.png')).toBe(false);
  });

  it('arquivo que não é imagem não passa, mesmo lido', () => {
    expect(mentionsImage([read('/Users/a/.env')], '/Users/a/.env')).toBe(false);
  });
});
