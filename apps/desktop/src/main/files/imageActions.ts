import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clipboard, ClipboardItem, shell } from 'electron';

// Botão direito na imagem aberta em tela cheia (as da conversa chegam em data URL, sem arquivo).

const EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  bmp: 'bmp',
  'svg+xml': 'svg',
  avif: 'avif',
  'x-icon': 'ico',
};

// Base64 de uns 50 MB; mais que isso não é print de conversa.
const LIMIT = 70_000_000;

function decode(dataUrl: unknown): { ext: string; data: Buffer } | null {
  if (typeof dataUrl !== 'string' || dataUrl.length > LIMIT) return null;
  const match = /^data:image\/([\w.+-]+);base64,/.exec(dataUrl);
  const ext = match?.[1] && EXTENSIONS[match[1].toLowerCase()];
  if (!match || !ext) return null;
  return { ext, data: Buffer.from(dataUrl.slice(match[0].length), 'base64') };
}

// A janela manda sempre PNG, o formato de imagem que a área de transferência aceita em todo sistema.
export async function copyImage(dataUrl: unknown): Promise<boolean> {
  const image = decode(dataUrl);
  if (image?.ext !== 'png') return false;
  try {
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(image.data)], { type: 'image/png' }) })]);
    return true;
  } catch (err) {
    console.warn('[imagem] não deu para copiar a imagem', err);
    return false;
  }
}

// Grava numa pasta temporária do sistema (que ele limpa) e mostra no Finder ou no Explorador de
// Arquivos. O nome vem do conteúdo: abrir a mesma imagem de novo não cria outra cópia.
export async function revealImage(dataUrl: unknown): Promise<boolean> {
  const image = decode(dataUrl);
  if (!image) return false;
  try {
    const dir = join(tmpdir(), 'argus-imagens');
    await mkdir(dir, { recursive: true });
    const hash = createHash('sha1').update(image.data).digest('hex').slice(0, 12);
    const path = join(dir, `imagem-${hash}.${image.ext}`);
    await writeFile(path, image.data);
    shell.showItemInFolder(path);
    return true;
  } catch (err) {
    console.warn('[imagem] não deu para gravar a imagem para mostrar na pasta', err);
    return false;
  }
}
