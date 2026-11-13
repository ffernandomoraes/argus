import { describe, expect, it } from 'vitest'
import { asPlatform } from '../../../../../test/platform'

// Link de arquivo no chat: abre no visualizador da pasta certa, ou na pasta do próprio arquivo.

const load = () => import('./fileInFolder')

describe('fileInFolder', () => {
  it('no Mac: caminho relativo ou absoluto dentro da pasta, com "~"', async () => {
    const { fileInFolder } = await asPlatform('darwin', load)
    expect(fileInFolder('~/proj', 'src/a.ts')).toBe('src/a.ts')
    expect(fileInFolder('~/proj', './src/a.ts')).toBe('src/a.ts')
    expect(fileInFolder('~/proj', '/Users/ana/proj/src/a.ts')).toBe('src/a.ts')
    expect(fileInFolder('/Users/ana/proj', '~/proj/a.ts')).toBe('a.ts')
  })

  it('fora da pasta, ou a própria pasta, não abre no visualizador dela', async () => {
    const { fileInFolder } = await asPlatform('darwin', load)
    expect(fileInFolder('~/proj', '/Users/ana/outro/a.ts')).toBeNull()
    expect(fileInFolder('~/proj', '/Users/ana/proj')).toBeNull()
  })

  // d9548a2: pasta com acento escolhida no macOS (NFD) contra o caminho do Claude (NFC).
  it('pasta com acento escrito de outro jeito', async () => {
    const { fileInFolder } = await asPlatform('darwin', load)
    expect(fileInFolder('~/gesta\u0303o', '/Users/ana/gest\u00e3o/a.ts')).toBe('a.ts')
  })

  it('no Windows: barra invertida vira "/" e o caminho do Git Bash é reconhecido', async () => {
    const { fileInFolder } = await asPlatform('win32', load)
    expect(fileInFolder('~\\proj', 'src\\a.ts')).toBe('src/a.ts')
    expect(fileInFolder('C:\\Users\\ana\\proj', 'C:\\Users\\ana\\proj\\src\\a.ts')).toBe('src/a.ts')
    expect(fileInFolder('C:\\Users\\ana\\proj', '/c/Users/ana/proj/a.ts')).toBe('a.ts')
    expect(fileInFolder('C:\\Users\\ana\\proj', 'D:\\proj\\a.ts')).toBeNull()
  })
})

// d9548a2: arquivo fora das pastas da conversa (a temporária do Claude, a da memória) abre pela
// pasta dele mesmo, em vez de não abrir.
describe('ownFolder', () => {
  it('no Mac, a pasta do arquivo vira a raiz', async () => {
    const { ownFolder } = await asPlatform('darwin', load)
    expect(ownFolder('/private/tmp/claude/x/plan.md')).toEqual({ root: '/private/tmp/claude/x', rel: 'plan.md' })
    expect(ownFolder('~/.claude/memory/a.md')).toEqual({ root: '/Users/ana/.claude/memory', rel: 'a.md' })
    expect(ownFolder('/a.pdf')).toEqual({ root: '/', rel: 'a.pdf' })
  })

  it('no Windows, a raiz do disco fica "C:\\"', async () => {
    const { ownFolder } = await asPlatform('win32', load)
    expect(ownFolder('C:\\Temp\\a.md')).toEqual({ root: 'C:\\Temp', rel: 'a.md' })
    expect(ownFolder('C:\\a.pdf')).toEqual({ root: 'C:\\', rel: 'a.pdf' })
  })

  it('caminho relativo não diz onde está', async () => {
    const { ownFolder } = await asPlatform('darwin', load)
    expect(ownFolder('src/a.ts')).toBeNull()
  })
})
