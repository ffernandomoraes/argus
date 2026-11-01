import { describe, expect, it } from 'vitest'
import { createImageViews } from './imageViews'

// A lista virtualizada desmonta o balão que fica longe da tela. Ao voltar, as miniaturas nasciam com
// quadros vazios e as imagens entravam um instante depois, mesmo já lidas: piscavam.
describe('createImageViews', () => {
  it('as imagens já lidas ficam à mão, sem esperar a leitura', async () => {
    const views = createImageViews(() => {})
    views.setReader(async (id) => [`data:${id}`])
    const view = views.viewFor('m1')
    expect(view.ready?.()).toBeUndefined()
    await view.load()
    expect(view.ready?.()).toEqual(['data:m1'])
  })

  it('a mensagem a caminho, com leitura própria, não guarda', () => {
    const views = createImageViews(() => {})
    expect(views.viewFor('w1', async () => ['blob:x']).ready).toBeUndefined()
  })
})
