// Visualizar: com o clique na página, o Esc fica nela e não chega ao Argus. Ligado, a página avisa
// o Esc ao drawer, que sai da visualização. Desligado, o Esc é só da página (fechar um modal dela).
// O `on` chega da tela: entra no script só como true ou false, nunca como texto.
export const escapeScript = (on: boolean): string => `(() => {
  window.__argusEscOn = ${on === true}
  if (window.__argusEsc) return
  window.__argusEsc = true
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.__argusEscOn) parent.postMessage({ argus: 'escape' }, '*')
  }, true)
})()`
