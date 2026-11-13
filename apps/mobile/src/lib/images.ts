import type { ChatImage } from '@argus/shared/chat';

// Fotos e prints para mandar ao Claude: lado maior até MAX_SIDE e arquivo pequeno (a foto do
// celular tem 4 a 12 MB; o Claude reduz o que passa disso de qualquer jeito).
const MAX_SIDE = 2000;
const KEEP_AS_IS = 1.5 * 1024 * 1024;
const DIRECT = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export const isImage = (f: File) => f.type.startsWith('image/');

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error ?? new Error('leitura'));
    r.readAsDataURL(blob);
  });
}

export async function imageForSend(file: File): Promise<ChatImage> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (DIRECT.includes(file.type) && file.size <= KEEP_AS_IS && Math.max(width, height) <= MAX_SIDE) {
    bitmap.close();
    return { mediaType: file.type, data: await readBase64(file) };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('imagem'))), 'image/jpeg', 0.85));
  return { mediaType: 'image/jpeg', data: await readBase64(blob) };
}
