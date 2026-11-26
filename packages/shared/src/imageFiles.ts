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

// Código em linha que é caminho de imagem (`/private/tmp/print.png`): o Claude costuma citar o
// arquivo assim, sem link. Precisa de uma barra; com espaço, só caminho absoluto, senão um comando
// (`open shots/a.png`) viraria caminho. null: não é.
export function inlineImagePath(code: string): string | null {
  const text = code.trim();
  if (!/[\\/]/.test(text)) return null;
  if (/\s/.test(text) && !/^(\/|~[\\/]|[a-zA-Z]:[\\/])/.test(text)) return null;
  return localImagePath(text);
}

// Trechos de código em linha de um texto em markdown (`assim`).
export function inlineCodes(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '');
}

// Caminho de imagem solto no texto ("salvei em /private/tmp/x/shot.png."): começo do texto, depois
// de espaço ou de pontuação de abertura; ao menos uma barra; sem espaço (no texto solto não dá para
// saber onde acaba); termina na extensão de imagem (o ponto final da frase fica de fora, mas
// "a.png.bak" não é imagem). Sem lookbehind: o Safari antigo não entende, e
// a expressão quebraria o app do celular inteiro ao carregar.
const PATH_IN_TEXT =
  /(^|[\s([{"'`*_>:])((?:~|[a-zA-Z]:)?[\\/]?(?:[^\s\\/`'"()<>[\]{}|*?]+[\\/])+[^\s\\/`'"()<>[\]{}|*?]+\.(?:png|jpe?g|gif|webp|bmp|svg|avif|ico))(?![\w/\\]|\.\w)/gi;

// Os caminhos de imagem soltos num texto, com a posição de cada um.
export function textImagePaths(text: string): { index: number; path: string }[] {
  return [...text.matchAll(PATH_IN_TEXT)].map((m) => ({ index: m.index + (m[1] ?? '').length, path: m[2] ?? '' }));
}

// A imagem aparece na conversa: o Claude leu o arquivo (o caminho da ferramenta) ou citou na
// resposta (link, imagem, código em linha ou caminho solto no texto). O celular só recebe imagens
// que passam aqui, não qualquer arquivo do disco.
export function mentionsImage(messages: Message[], path: string): boolean {
  if (!imageType(path)) return false;
  return messages.some(
    (m) =>
      (m.role === 'tool' && m.detail === path) ||
      (m.role === 'assistant' &&
        (markdownTargets(m.text).some((t) => localImagePath(t) === path) ||
          inlineCodes(m.text).some((c) => inlineImagePath(c) === path) ||
          textImagePaths(m.text).some((t) => t.path === path))),
  );
}
