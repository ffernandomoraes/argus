import { beforeEach, describe, expect, it, vi } from 'vitest'
import { showMessageBox } from './messageBox'

// 2026-10-23 (ARGUS-3): no macOS, a caixa sem janela dona parava o processo principal até a
// resposta. Com a do "Procurar atualizações…" aberta, a saída dos terminais e as conversas paravam.

const electron = vi.hoisted(() => ({
  focused: null as object | null,
  showMessageBox: vi.fn(async (..._args: unknown[]) => ({ response: 0, checkboxChecked: false }))
}))
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => electron.focused },
  dialog: { showMessageBox: electron.showMessageBox }
}))
// Janelas do app (canvas e conversa); a do mascote não entra.
const appWindows = vi.hoisted(() => new Set<object>())
vi.mock('./windowChrome', () => ({ isAppWindow: (win: object) => appWindows.has(win) }))

beforeEach(() => {
  electron.focused = null
  electron.showMessageBox.mockClear()
  appWindows.clear()
})

const options = { message: 'A versão 0.1.81 está pronta.' }

describe('showMessageBox', () => {
  it('presa à janela do Argus em foco', async () => {
    const canvas = {}
    appWindows.add(canvas)
    electron.focused = canvas
    await showMessageBox(options)
    expect(electron.showMessageBox.mock.calls).toEqual([[canvas, options]])
  })

  it('sem janela do Argus em foco, solta, para aparecer na frente; o mascote nunca fica com ela', async () => {
    await showMessageBox(options)
    electron.focused = {}
    await showMessageBox(options)
    expect(electron.showMessageBox.mock.calls).toEqual([[options], [options]])
  })
})
