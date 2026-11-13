import { describe, expect, it } from 'vitest'
import { fromLinux, isWslPath, parseWslPath, sameDistro, toLinux, toUnc } from './path'

// Pasta do WSL decide onde o agente roda (ver wsl/index.ts): erro aqui manda a conversa para o
// sistema errado ou para uma pasta que não existe. Funções puras, conferidas em qualquer sistema.

describe('parseWslPath', () => {
  it('lê a distro e o caminho do Linux, no nome novo e no antigo', () => {
    expect(parseWslPath('\\\\wsl.localhost\\Ubuntu\\home\\ana\\proj')).toEqual({ distro: 'Ubuntu', linux: '/home/ana/proj' })
    expect(parseWslPath('\\\\wsl$\\Debian\\home\\ana')).toEqual({ distro: 'Debian', linux: '/home/ana' })
    expect(parseWslPath('//wsl.localhost/Ubuntu/home/ana/')).toEqual({ distro: 'Ubuntu', linux: '/home/ana' })
    expect(parseWslPath('\\\\WSL.LOCALHOST\\Ubuntu')).toEqual({ distro: 'Ubuntu', linux: '/' })
  })

  it('nulo para o que não é do WSL', () => {
    expect(parseWslPath('C:\\Users\\ana')).toBeNull()
    expect(parseWslPath('\\\\servidor\\pasta')).toBeNull()
    expect(parseWslPath('/home/ana')).toBeNull()
  })
})

describe('toLinux', () => {
  it('pasta do WSL vira o caminho de dentro do Linux', () => {
    expect(toLinux('\\\\wsl.localhost\\Ubuntu\\home\\ana\\proj')).toBe('/home/ana/proj')
  })

  it('disco do Windows vira /mnt/<letra>', () => {
    expect(toLinux('C:\\Users\\ana\\proj')).toBe('/mnt/c/Users/ana/proj')
    expect(toLinux('D:/dados/')).toBe('/mnt/d/dados')
    expect(toLinux('C:\\')).toBe('/mnt/c')
  })

  it('outro caminho só troca as barras', () => {
    expect(toLinux('/home/ana')).toBe('/home/ana')
    expect(toLinux('src\\a.ts')).toBe('src/a.ts')
  })
})

describe('fromLinux e toUnc', () => {
  it('caminho do Linux volta a ser o que o Windows enxerga', () => {
    expect(fromLinux('Ubuntu', '/home/ana/proj/a.ts')).toBe('\\\\wsl.localhost\\Ubuntu\\home\\ana\\proj\\a.ts')
    expect(fromLinux('Ubuntu', '/mnt/c/Users/ana')).toBe('C:\\Users\\ana')
    expect(fromLinux('Ubuntu', '/mnt/d')).toBe('D:\\')
  })

  it('ida e volta dão a mesma pasta', () => {
    const unc = toUnc('Ubuntu', '/home/ana/proj')
    expect(parseWslPath(unc)).toEqual({ distro: 'Ubuntu', linux: '/home/ana/proj' })
    expect(toLinux(fromLinux('Ubuntu', '/mnt/c/x/y'))).toBe('/mnt/c/x/y')
  })
})

describe('isWslPath e sameDistro', () => {
  it('só o Windows tem pasta do WSL', () => {
    expect(isWslPath('\\\\wsl.localhost\\Ubuntu\\home')).toBe(process.platform === 'win32')
    expect(isWslPath('C:\\x')).toBe(false)
  })

  it('o nome da distro não diferencia maiúsculas', () => {
    expect(sameDistro('Ubuntu', 'ubuntu')).toBe(true)
    expect(sameDistro('Ubuntu', 'Debian')).toBe(false)
  })
})
