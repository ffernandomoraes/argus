import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { focusWhenVisible } from '../../canvas/blocks/useFocusWhenVisible'
import { IS_LINUX, IS_WIN } from '../../platform'
import { TERMINAL_FONT, TERMINAL_THEME } from './theme'
import { fixMouseForZoom } from './zoomCorrection'

export type Xterm = {
  term: Terminal
  // Troca o tamanho da fonte e reencaixa (colunas e linhas mudam; quem ouve term.onResize sabe).
  setFontSize(px: number): void
  dispose(): void
}

// Windows: Ctrl+C copia quando há texto selecionado (sem seleção, interrompe, como sempre) e
// Ctrl+V cola, como no Terminal do Windows e no VS Code. No Mac, ⌘C e ⌘V passam pelo menu Editar.
function windowsClipboard(term: Terminal): void {
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true
    const key = e.key.toLowerCase()
    if (key === 'c' && (e.shiftKey || term.hasSelection())) {
      e.preventDefault()
      void navigator.clipboard.writeText(term.getSelection())
      term.clearSelection()
      return false
    }
    // O xterm não trata a tecla: o navegador cola, e o texto chega pelo evento de colar.
    return key !== 'v'
  })
}

// Linux: como no terminal do GNOME e no Konsole, Ctrl+Shift+C copia e Ctrl+Shift+V cola; o Ctrl+C
// continua interrompendo o programa.
function linuxClipboard(term: Terminal): void {
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey || e.altKey) return true
    const key = e.key.toLowerCase()
    if (key === 'c') {
      e.preventDefault()
      if (term.hasSelection()) void navigator.clipboard.writeText(term.getSelection())
      return false
    }
    // O xterm não trata a tecla: o navegador cola, e o texto chega pelo evento de colar.
    return key !== 'v'
  })
}

// Windows: o xterm precisa saber que do outro lado está o ConPTY (o node-pty 1.x só usa ele) e o
// build do sistema. Sem isso, aumentar o número de linhas podia sobrescrever ou perder linhas, porque
// o ConPTY redesenha a tela do jeito dele (ver windowsPty em @xterm/xterm/typings/xterm.d.ts).
const windowsPty = IS_WIN ? { backend: 'conpty' as const, buildNumber: window.api.windowsBuild ?? undefined } : undefined

// Desenho pela placa de vídeo (WebGL), bem mais leve que o padrão (o texto em HTML) com muita
// saída. Só fora do canvas: lá o zoom escala o bloco, e o WebGL desenha numa imagem que borra ao
// ampliar, enquanto o HTML refaz o texto em cada zoom. Sem WebGL (a placa recusou, ou o navegador
// tirou o contexto, que tem limite por página), fica o padrão.
function drawWithGpu(term: Terminal): void {
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
  } catch (err) {
    console.warn('[terminal] sem WebGL, fica o desenho padrão:', err)
  }
}

// Terminal do xterm dentro de `el`, já encaixado no tamanho dele e, com `focus`, com o foco. O
// tamanho segue o do elemento: cada mudança reencaixa uma vez por quadro (arrastar a borda do bloco
// muda a cada quadro). `el` não pode ter padding: o encaixe mede o elemento inteiro e cortaria a
// última linha. `gpu`: desenha pelo WebGL (só onde não há zoom, ver drawWithGpu).
export function createXterm(el: HTMLElement, fontSize: number, focus = true, gpu = false): Xterm {
  const term = new Terminal({
    windowsPty,
    fontFamily: TERMINAL_FONT,
    fontSize,
    lineHeight: 1.2,
    cursorBlink: true,
    macOptionIsMeta: true,
    scrollback: 5000,
    theme: TERMINAL_THEME
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(el)
  // Depois do open: o WebGL precisa do elemento na página.
  if (gpu) drawWithGpu(term)
  fixMouseForZoom(term)
  if (IS_WIN) windowsClipboard(term)
  if (IS_LINUX) linuxClipboard(term)
  fit.fit()
  // O bloco recém-criado no canvas nasce invisível até o React Flow medir o tamanho dele, e o
  // term.focus() direto falhava: a pessoa tinha que clicar no terminal para digitar.
  const stopFocus = focus ? focusWhenVisible(() => term.textarea ?? null) : () => {}

  let frame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => fit.fit())
  })
  observer.observe(el)

  return {
    term,
    setFontSize(px) {
      term.options.fontSize = px
      fit.fit()
    },
    dispose() {
      stopFocus()
      cancelAnimationFrame(frame)
      observer.disconnect()
      term.dispose()
    }
  }
}
