import { describe, expect, it } from 'vitest';
import { imageFiles } from './chatImages';

// O "Reenviar" manda de novo as imagens da mensagem que falhou, lidas do histórico como data URLs.
describe('imageFiles', () => {
  it('data URL do histórico vira um arquivo de imagem com os mesmos bytes', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const url = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const [file] = imageFiles([url]);
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('imagem-1.png');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(png);
  });

  it('o que não é data URL em base64 fica de fora', () => {
    expect(imageFiles(['https://exemplo.com/a.png', 'data:image/png,cru'])).toEqual([]);
  });
});
