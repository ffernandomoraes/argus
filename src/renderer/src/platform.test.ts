import { describe, expect, it } from 'vitest'
import { asPlatform } from '../../../test/platform'

const load = () => import('./platform')

describe('relativeTo no Mac', () => {
  it('dá o caminho dentro da pasta, com "/"', async () => {
    const { relativeTo } = await asPlatform('darwin', load)
    expect(relativeTo('/Users/ana/proj/src/a.ts', '/Users/ana/proj')).toBe('src/a.ts')
    expect(relativeTo('/Users/ana/proj', '/Users/ana/proj/')).toBe('')
  })

  it('não confunde pasta com outra que começa igual', async () => {
    const { relativeTo } = await asPlatform('darwin', load)
    expect(relativeTo('/Users/ana/projeto/a.ts', '/Users/ana/proj')).toBeNull()
    expect(relativeTo('/Users/ana', '/Users/ana/proj')).toBeNull()
  })

  // Bug de 2026-10-22: a pasta escolhida no macOS chega com o acento decomposto (NFD) e o Claude
  // escreve com o acento num caractere só (NFC); os links da pasta "gestão" não abriam.
  it('acha o arquivo com o acento escrito de qualquer jeito', async () => {
    const { relativeTo } = await asPlatform('darwin', load)
    const nfd = '/Users/ana/gesta\u0303o'
    const nfc = '/Users/ana/gest\u00e3o/a.ts'
    expect(relativeTo(nfc, nfd)).toBe('a.ts')
    expect(relativeTo(nfd + '/a.ts', '/Users/ana/gest\u00e3o')).toBe('a.ts')
  })

  it('diferencia maiúsculas, como o disco do Mac pode diferenciar', async () => {
    const { relativeTo } = await asPlatform('darwin', load)
    expect(relativeTo('/Users/ana/Proj/a.ts', '/Users/ana/proj')).toBeNull()
  })
})

describe('relativeTo no Windows', () => {
  it('aceita "\\" e "/" e não diferencia maiúsculas', async () => {
    const { relativeTo } = await asPlatform('win32', load)
    expect(relativeTo('C:\\Users\\ana\\proj\\src\\a.ts', 'C:\\Users\\ana\\proj')).toBe('src/a.ts')
    expect(relativeTo('c:/users/ana/PROJ/src/a.ts', 'C:\\Users\\ana\\proj')).toBe('src/a.ts')
  })

  it('entende o caminho do Git Bash ("/c/Users/...")', async () => {
    const { relativeTo } = await asPlatform('win32', load)
    expect(relativeTo('/c/Users/ana/proj/a.ts', 'C:\\Users\\ana\\proj')).toBe('a.ts')
  })

  it('numa pasta do WSL, traduz o caminho do Linux que o Claude escreve', async () => {
    const { relativeTo } = await asPlatform('win32', load)
    const dir = '\\\\wsl.localhost\\Ubuntu\\home\\ana\\proj'
    expect(relativeTo('/home/ana/proj/src/a.ts', dir)).toBe('src/a.ts')
    expect(relativeTo('/home/ana/outro/a.ts', dir)).toBeNull()
  })
})

describe('tildify e untildify', () => {
  it('troca a pasta pessoal por "~" e volta', async () => {
    const { tildify, untildify } = await asPlatform('darwin', load)
    expect(tildify('/Users/ana/proj')).toBe('~/proj')
    expect(tildify('/Users/ana')).toBe('~')
    expect(tildify('/tmp/x')).toBe('/tmp/x')
    expect(untildify('~/proj')).toBe('/Users/ana/proj')
    expect(untildify('~')).toBe('/Users/ana')
  })

  it('no Windows, com "\\"', async () => {
    const { tildify, untildify } = await asPlatform('win32', load)
    expect(tildify('C:\\Users\\ana\\proj\\src')).toBe('~\\proj\\src')
    expect(untildify('~\\proj')).toBe('C:\\Users\\ana\\proj')
    expect(untildify('~/proj')).toBe('C:\\Users\\ana\\proj')
  })
})

describe('isAbsolutePath, baseName e parentDir', () => {
  it('no Mac', async () => {
    const { isAbsolutePath, baseName, parentDir } = await asPlatform('darwin', load)
    expect(isAbsolutePath('/a/b')).toBe(true)
    expect(isAbsolutePath('a/b')).toBe(false)
    expect(isAbsolutePath('C:\\a')).toBe(false)
    expect(baseName('/a/b/c.ts')).toBe('c.ts')
    expect(baseName('/a/b/')).toBe('b')
    expect(parentDir('/a/b/c.ts')).toBe('/a/b')
  })

  it('no Windows', async () => {
    const { isAbsolutePath, baseName, parentDir } = await asPlatform('win32', load)
    expect(isAbsolutePath('C:\\a')).toBe(true)
    expect(isAbsolutePath('c:/a')).toBe(true)
    expect(isAbsolutePath('\\\\wsl.localhost\\Ubuntu')).toBe(true)
    expect(isAbsolutePath('/c/Users')).toBe(true)
    expect(isAbsolutePath('src\\a.ts')).toBe(false)
    expect(baseName('C:\\a\\b.ts')).toBe('b.ts')
    expect(parentDir('C:\\a\\b.ts')).toBe('C:\\a')
  })
})

describe('keys', () => {
  it('no Mac, o atalho como veio', async () => {
    const { keys } = await asPlatform('darwin', load)
    expect(keys('⇧⌘Z')).toBe('⇧⌘Z')
  })

  it('no Windows, com Ctrl na ordem do sistema', async () => {
    const { keys } = await asPlatform('win32', load)
    expect(keys('⌘S')).toBe('Ctrl+S')
    expect(keys('⇧⌘Z')).toBe('Ctrl+Shift+Z')
    expect(keys('⌘ ,')).toBe('Ctrl+,')
    expect(keys('⌘⌫')).toBe('Ctrl+Backspace')
  })
})
