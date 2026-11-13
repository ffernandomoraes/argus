const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon'
}

// Tipo da imagem pelo nome do arquivo (aceita "\" do Windows); null = não é imagem que o <img> mostre.
export function imageType(path: string): string | null {
  const ext = /\.([^.\\/]+)$/.exec(path)?.[1]?.toLowerCase()
  return (ext && TYPES[ext]) || null
}
