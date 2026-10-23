import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandHome, inside, insideRoot, isDirectory, realRoot } from './paths'

describe('expandHome', () => {
  it('troca "~" pela pasta do usuário, como o canvas guarda as pastas', () => {
    expect(expandHome('~')).toBe(homedir())
    expect(expandHome('~/proj')).toBe(homedir() + '/proj')
    expect(expandHome('/abs/proj')).toBe('/abs/proj')
    // "~ana" é outra coisa (pasta de outro usuário no shell): fica como veio.
    expect(expandHome('~ana/proj')).toBe('~ana/proj')
  })

  it.runIf(process.platform === 'win32')('no Windows, também "~\\"', () => {
    expect(expandHome('~\\proj')).toBe(homedir() + '\\proj')
  })
})

describe('insideRoot', () => {
  const root = join(homedir(), 'proj')

  it('resolve o caminho dentro da pasta', () => {
    expect(insideRoot(root, 'src/a.ts')).toBe(join(root, 'src', 'a.ts'))
    expect(insideRoot('~/proj', 'a.ts')).toBe(join(root, 'a.ts'))
  })

  // Quem escreve arquivos a pedido da janela (editor, design) confia nisto para não sair da pasta.
  it('recusa o que tenta sair dela', () => {
    expect(insideRoot(root, '../outro/a.ts')).toBeNull()
    expect(insideRoot(root, '..')).toBeNull()
    expect(insideRoot(root, 'src/../../x')).toBeNull()
    expect(insideRoot(root, '/etc/passwd')).toBeNull()
  })

  it('aceita pasta que só começa com dois pontos', () => {
    expect(insideRoot(root, '..dados/a.json')).toBe(join(root, '..dados', 'a.json'))
  })

  it.runIf(process.platform === 'win32')('no Windows, recusa outro disco', () => {
    expect(insideRoot('C:\\proj', 'D:\\x')).toBeNull()
  })
})

describe('inside', () => {
  it('a raiz e o que está dentro, não a pasta vizinha com nome parecido', () => {
    const root = join(homedir(), 'proj')
    expect(inside(root, root)).toBe(true)
    expect(inside(root, root + sep + 'src')).toBe(true)
    expect(inside(root, root + '-old')).toBe(false)
  })
})

describe('isDirectory e realRoot', () => {
  it('nunca lança, nem para o que não existe', () => {
    const dir = mkdtempSync(join(homedir(), 'paths-'))
    expect(isDirectory(dir)).toBe(true)
    expect(isDirectory(join(dir, 'nada'))).toBe(false)
    expect(realRoot(join(dir, 'nada'))).toBe(join(dir, 'nada'))
  })

  // O lsof (servidores rodando) devolve a pasta real: o atalho precisa dar a mesma.
  it.skipIf(process.platform === 'win32')('segue o atalho até a pasta real', () => {
    const dir = mkdtempSync(join(homedir(), 'paths-'))
    mkdirSync(join(dir, 'real'))
    symlinkSync(join(dir, 'real'), join(dir, 'link'))
    expect(realRoot(join(dir, 'link'))).toBe(realRoot(join(dir, 'real')))
  })
})
