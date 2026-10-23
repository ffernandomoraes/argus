import { describe, expect, it } from 'vitest'
import { isLinuxAsset, isMacAsset, isNewer, isWindowsAsset, newestWith, previousWith, type Release } from './releases'

// O atualizador é o caminho de toda correção até quem usa: se ele erra a versão ou o arquivo,
// ninguém recebe mais nada.

const asset = (name: string) => ({ name, size: 1, browser_download_url: `https://example.test/${name}` })

const release = (version: string, extra: Partial<Release> = {}): Release => ({
  tag_name: `v${version}`,
  html_url: `https://example.test/v${version}`,
  assets: [asset(`Argus-${version}-arm64.zip`), asset(`Argus-Setup-${version}.exe`), asset(`Argus-${version}-x86_64.AppImage`)],
  ...extra
})

describe('isNewer', () => {
  it('compara número a número, não como texto', () => {
    expect(isNewer('0.10.0', '0.9.3')).toBe(true)
    expect(isNewer('0.1.80', '0.1.79')).toBe(true)
    expect(isNewer('1.0.0', '0.99.99')).toBe(true)
    expect(isNewer('0.9.3', '0.10.0')).toBe(false)
  })

  it('a mesma versão não é mais nova', () => {
    expect(isNewer('0.1.79', '0.1.79')).toBe(false)
  })
})

describe('arquivos de cada sistema', () => {
  it('reconhece o de cada um, e só o dele', () => {
    expect(isMacAsset(asset('Argus-0.1.80-arm64.zip'))).toBe(true)
    expect(isWindowsAsset(asset('Argus-Setup-0.1.80.exe'))).toBe(true)
    expect(isLinuxAsset(asset('Argus-0.1.80-x86_64.AppImage'))).toBe(true)
    expect(isLinuxAsset(asset('Argus-0.1.80-x64.AppImage'))).toBe(true)

    expect(isMacAsset(asset('Argus-0.1.80-arm64.dmg'))).toBe(false)
    expect(isWindowsAsset(asset('Argus-Setup-0.1.80.exe.blockmap'))).toBe(false)
    expect(isLinuxAsset(asset('Argus-0.1.80-arm64.AppImage'))).toBe(false)
  })
})

describe('newestWith', () => {
  it('escolhe a mais nova com o arquivo do sistema, em qualquer ordem', () => {
    const pick = newestWith([release('0.1.80'), release('0.1.82'), release('0.1.81')], '0.1.79', isMacAsset)
    expect(pick?.version).toBe('0.1.82')
    expect(pick?.asset.name).toBe('Argus-0.1.82-arm64.zip')
  })

  it('pula rascunho, pré-lançamento e versão sem o arquivo', () => {
    const releases = [
      release('0.1.83', { draft: true }),
      release('0.1.82', { prerelease: true }),
      release('0.1.81', { assets: [asset('Argus-0.1.81-arm64.zip')] }),
      release('0.1.80')
    ]
    expect(newestWith(releases, '0.1.79', isWindowsAsset)?.version).toBe('0.1.80')
  })

  it('nada quando a versão em uso já é a mais nova', () => {
    expect(newestWith([release('0.1.79'), release('0.1.78')], '0.1.79', isMacAsset)).toBeNull()
  })
})

describe('previousWith', () => {
  it('a versão logo antes da em uso, para voltar de uma que quebrou', () => {
    const releases = [release('0.1.80'), release('0.1.77'), release('0.1.78', { draft: true }), release('0.1.76')]
    expect(previousWith(releases, '0.1.80', isMacAsset)?.version).toBe('0.1.77')
  })

  it('nada quando não há anterior', () => {
    expect(previousWith([release('0.1.80')], '0.1.80', isMacAsset)).toBeNull()
  })
})
