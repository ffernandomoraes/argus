// Janela sem ninguém olhando (sem foco ou escondida): marca `data-window="idle"` no <html>, e as
// animações infinitas param onde estão (--anim-state, em styles/animations.css). Uma animação só
// rodando já faz a janela inteira ser redesenhada a cada quadro; em 2026-10-16, com uma conversa
// rodando, a GPU do Argus ficava em ~45% mesmo com outro app na frente.
//
// O foco é o que conta: a janela visível num segundo monitor, atrás de um editor, não está
// "escondida" para o Chromium e continua desenhando em tempo cheio. Na dúvida, vale "ativa": o pior
// caso é uma animação rodando à toa, nunca uma parada com alguém olhando.

const ATTR = 'data-window'

// O mesmo estado para o que roda git de fundo (a faixa dos worktrees, o git status das pastas):
// como o VS Code, espera alguém voltar para a janela. Janela sem o vigia instalado (a do mascote)
// conta como ativa.
let idle = false
const onActive = new Set<() => void>()

export const windowActive = (): boolean => !idle

// Chamado quando a janela volta a ter alguém olhando; devolve como parar de ouvir.
export function onWindowActive(fn: () => void): () => void {
  onActive.add(fn)
  return () => onActive.delete(fn)
}

export function installWindowActivity(): void {
  const root = document.documentElement

  const apply = () => {
    const next = !document.hasFocus() || document.visibilityState === 'hidden'
    if (next === idle) return
    idle = next
    if (idle) root.setAttribute(ATTR, 'idle')
    else root.removeAttribute(ATTR)
    if (!idle) for (const fn of [...onActive]) fn()
  }
  // Lido no tique seguinte: clicar num iframe dispara `blur` na janela antes de o foco
  // chegar nele, e só depois `hasFocus()` responde que a janela continua com o foco.
  const schedule = () => setTimeout(apply, 0)

  window.addEventListener('focus', schedule)
  window.addEventListener('blur', schedule)
  document.addEventListener('visibilitychange', schedule)
  apply()
}
