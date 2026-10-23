import { describe, expect, it } from 'vitest'
import { image, queued, text, user } from '../../../test/transcript'
import { ImageIndex, imagesOf } from './images'

describe('imagesOf', () => {
  it('as imagens da mensagem, prontas para o <img>', () => {
    expect(imagesOf(user([text('olha'), image('QUJD', 'image/jpeg')]))).toEqual(['data:image/jpeg;base64,QUJD'])
  })

  // Bug corrigido em 7a65f91: o print enviado no meio de uma resposta fica no prompt do anexo.
  it('acha o print da mensagem enviada no meio da resposta', () => {
    expect(imagesOf(queued([text('e isso'), image('WFla')]))).toEqual(['data:image/png;base64,WFla'])
  })

  it('imagem sem os dados não entra', () => {
    expect(imagesOf(user([{ type: 'image', source: { type: 'url', url: 'https://x' } }]))).toEqual([])
  })
})

describe('ImageIndex', () => {
  it('guarda onde ficam só as linhas com imagem, a primeira vez', () => {
    const index = new ImageIndex()
    const withImage = queued([image()])
    const plain = user('sem imagem')
    index.add(withImage, 10, 20)
    index.add(withImage, 30, 40)
    index.add(plain, 50, 60)
    expect(index.find(withImage.uuid as string)).toEqual({ start: 10, end: 20 })
    expect(index.find(plain.uuid as string)).toBeUndefined()
  })
})
