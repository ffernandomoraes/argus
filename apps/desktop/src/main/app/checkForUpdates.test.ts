import { describe, expect, it, vi } from 'vitest'
import type { Updater } from '../updater'
import { checkForUpdates } from './checkForUpdates'

// "Procurar atualizações…" do menu. A caixa presa à janela deixa o menu livre enquanto está aberta.

const box = vi.hoisted(() => ({ shown: 0, close: () => {} }))
vi.mock('electron', () => ({ app: { getVersion: () => '0.1.80' } }))
vi.mock('../i18n', () => ({ tr: (pt: string) => pt }))
vi.mock('./messageBox', () => ({
  showMessageBox: () => {
    box.shown++
    return new Promise((resolve) => (box.close = () => resolve({ response: 1, checkboxChecked: false })))
  }
}))

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('checkForUpdates', () => {
  it('clicar de novo com a caixa aberta não abre outra; fechada, o próximo clique procura de novo', async () => {
    const check = vi.fn(async () => ({ status: 'latest' }))
    const updater = { check } as unknown as Updater
    const restart = vi.fn(async () => {})
    const first = checkForUpdates(updater, restart)
    await settle()
    expect(checkForUpdates(updater, restart)).toBe(first)
    box.close()
    await first
    expect([check.mock.calls.length, box.shown]).toEqual([1, 1])
    const again = checkForUpdates(updater, restart)
    await settle()
    box.close()
    await again
    expect([check.mock.calls.length, box.shown]).toEqual([2, 2])
  })
})
