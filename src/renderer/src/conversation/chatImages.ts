import type { ChatImage } from '../../../shared/chat'
import { fitScale, MAX_IMAGE_BYTES, MAX_SEND_BASE64, MEASURE_FROM_BYTES, megabytes, needsShrink, shrinkType } from './imageLimits'

// Imagens que vão junto da mensagem (o resto dos anexos vai pelo caminho no disco).
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const isSendableImage = (file: File) => IMAGE_TYPES.includes(file.type)

function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('Não deu para ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

// As imagens da mensagem em base64, prontas para o envio. A que passa do limite da API (tamanho ou
// lado) é reduzida aqui, no mesmo tipo quando dá; as que ficam dentro vão como estão. Se o total
// ainda passar do limite do pedido, a promessa falha com o aviso para a pessoa (o texto volta para
// o campo: ver o envio no Composer).
export async function imagesForSend(files: File[]): Promise<ChatImage[]> {
  const images = await Promise.all(files.filter(isSendableImage).map(prepareImage))
  const total = images.reduce((n, i) => n + i.data.length, 0)
  if (total > MAX_SEND_BASE64) {
    throw new Error(
      `As imagens somam ${megabytes(total)} MB e o limite por mensagem é de ${megabytes(MAX_SEND_BASE64)} MB. Envie menos de cada vez.`
    )
  }
  return images
}

async function prepareImage(file: File): Promise<ChatImage> {
  const asIs = async (): Promise<ChatImage> => ({ mediaType: file.type, data: await toBase64(file) })
  if (file.size <= MEASURE_FROM_BYTES) return asIs()
  // Formato que o navegador não abre: vai como está, e a API decide.
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return asIs()
  try {
    return needsShrink(file.size, bitmap.width, bitmap.height) ? await shrink(bitmap, file) : await asIs()
  } finally {
    bitmap.close()
  }
}

// Reduz até caber: algumas tentativas no tipo original e, no fim, JPEG (PNG de foto grande quase
// não encolhe).
async function shrink(bitmap: ImageBitmap, file: File): Promise<ChatImage> {
  const type = shrinkType(file.type)
  let scale = fitScale(file.size, bitmap.width, bitmap.height)
  for (let attempt = 0; attempt < 4; attempt++) {
    const blob = await draw(bitmap, scale, type)
    if (blob.size <= MAX_IMAGE_BYTES) return { mediaType: blob.type || type, data: await toBase64(blob) }
    scale *= 0.75
  }
  const blob = await draw(bitmap, scale, 'image/jpeg', 0.85)
  return { mediaType: 'image/jpeg', data: await toBase64(blob) }
}

function draw(bitmap: ImageBitmap, scale: number, type: string, quality?: number): Promise<Blob> {
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Não deu para reduzir a imagem.'))
  // JPEG não tem transparência: o fundo transparente ficaria preto.
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas.convertToBlob({ type, quality })
}
