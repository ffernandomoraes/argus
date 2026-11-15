import type { Message } from './history';

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

// Tipo da imagem pelo nome do arquivo (aceita "\" do Windows); null = não é imagem que o <img> mostre.
export function imageType(path: string): string | null {
  const ext = /\.([^.\\/]+)$/.exec(path)?.[1]?.toLowerCase();
  return (ext && TYPES[ext]) || null;
}

// Endereço de um link ou imagem do markdown que aponta para uma imagem no computador: sem o
// file://, decodificado e sem o #trecho. null: endereço da web (ou data:, mailto:...) ou não é
// imagem. "C:\..." não é endereço da web: o esquema tem mais de uma letra.
export function localImagePath(href: string): string | null {
  if (/^[a-z][a-z0-9+.-]+:/i.test(href) && !/^file:/i.test(href)) return null;
  let path = href.replace(/^<|>$/g, '').replace(/^file:\/\//i, '').split('#')[0] ?? '';
  try {
    path = decodeURIComponent(path);
  } catch {
    // Com % solto: vale como está.
  }
  // file:///C:/proj/a.png deixa uma barra antes da letra do disco.
  if (/^\/[a-zA-Z]:[\\/]/.test(path)) path = path.slice(1);
  return path && imageType(path) ? path : null;
}

// Destinos dos links e imagens de um texto em markdown: [x](destino), ![x](destino) e
// [x](<destino com espaço>).
export function markdownTargets(text: string): string[] {
  return [...text.matchAll(/\]\(\s*(<[^>\n]+>|[^\s)]+)/g)].map((m) => m[1] ?? '');
}

// A imagem aparece na conversa: o Claude leu o arquivo (o caminho da ferramenta) ou citou num link
// ou imagem da resposta. O celular só recebe imagens que passam aqui, não qualquer arquivo do disco.
export function mentionsImage(messages: Message[], path: string): boolean {
  if (!imageType(path)) return false;
  return messages.some(
    (m) =>
      (m.role === 'tool' && m.detail === path) ||
      (m.role === 'assistant' && markdownTargets(m.text).some((t) => localImagePath(t) === path)),
  );
}
