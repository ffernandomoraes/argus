// Limites da API do Claude para imagens: 5 MB por imagem e 32 MB por pedido, contados no base64
// (4/3 do arquivo). Com margem: o pedido leva também o texto e o resto da conversa.
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024
// Arquivo cujo base64 ainda cabe na imagem, com 5% de folga.
export const MAX_IMAGE_BYTES = Math.floor(MAX_IMAGE_BASE64 * 0.75 * 0.95)
export const MAX_SEND_BASE64 = 20 * 1024 * 1024
// Lado máximo que a API aceita.
export const MAX_SIDE = 8000
// Até este tamanho a imagem nem é aberta para medir: lado acima do máximo só aparece em arquivo grande.
export const MEASURE_FROM_BYTES = 1024 * 1024

export const needsShrink = (bytes: number, width: number, height: number) =>
  bytes > MAX_IMAGE_BYTES || Math.max(width, height) > MAX_SIDE

// Escala da primeira tentativa de redução (1 quando já cabe). O arquivo cai mais ou menos com a
// área, que cai com o quadrado da escala: começa um pouco abaixo da conta para acertar de primeira.
export function fitScale(bytes: number, width: number, height: number): number {
  let scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  if (bytes > MAX_IMAGE_BYTES) scale = Math.min(scale, Math.sqrt(MAX_IMAGE_BYTES / bytes) * 0.9)
  return scale
}

// Tipo da imagem reduzida: o mesmo quando o canvas sabe gravar; o resto (GIF) vira PNG.
export function shrinkType(type: string): string {
  return type === 'image/jpeg' || type === 'image/webp' || type === 'image/png' ? type : 'image/png'
}

// "21,4" (MB) para o aviso.
export const megabytes = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
