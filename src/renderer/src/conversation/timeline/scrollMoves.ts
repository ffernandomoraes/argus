// Quanto da rolagem foi sua entre um evento de rolagem e o seguinte. A lista virtualizada também
// mexe na rolagem: ao medir pela primeira vez um item acima da tela, ela empurra a rolagem pela
// diferença e o que você lê fica parado (o mesmo vale para a volta ao lugar quando chegam as
// mensagens anteriores). Contado como rolagem sua, isso virava "descendo" no meio da subida: o
// prompt preso no topo sumia e voltava, piscando, a cada item medido (useStickyScroll).
export type ScrollMoves = {
  // A lista moveu a rolagem em `px` (o quanto andou de fato).
  shift: (px: number) => void
  // Evento de rolagem com a área em `top`: quanto andou por você e se foi só a lista.
  read: (top: number) => { delta: number; listOnly: boolean }
}

export function createScrollMoves(): ScrollMoves {
  let last = 0
  let shifted = 0
  return {
    shift(px) {
      shifted += px
    },
    read(top) {
      const delta = top - last - shifted
      // Meio pixel de folga: com o zoom do drawer, a posição da rolagem tem casas decimais.
      const listOnly = shifted !== 0 && Math.abs(delta) < 0.5
      last = top
      shifted = 0
      return { delta, listOnly }
    }
  }
}
