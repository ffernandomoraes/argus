#!/bin/sh
# Imagens do README (docs/images/*.png): as ilustrações da landing (apps/website), em PNG.
# Cada uma é presa no topo da tela, com uma margem na cor do site, e capturada com a agent-browser.
# Rodar da raiz do repositório: sh scripts/capture-readme-images.sh
set -e

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/docs/images"
mkdir -p "$out"

agent-browser set viewport 1280 1400 2 >/dev/null
agent-browser set media dark reduced-motion >/dev/null
agent-browser open "file://$root/apps/website/index.html" >/dev/null

# capture <seletor CSS> <índice> <arquivo>
capture() {
  agent-browser eval "(() => {
    document.getElementById('readme-shot')?.remove();
    document.querySelectorAll('[data-readme-shot]').forEach((el) => { el.removeAttribute('style'); el.removeAttribute('data-readme-shot'); });
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    const el = document.querySelectorAll('$1')[$2];
    const pad = 28;
    const width = el.getBoundingClientRect().width;
    el.dataset.readmeShot = '';
    Object.assign(el.style, { position: 'fixed', top: pad + 'px', left: pad + 'px', width: width + 'px', margin: '0', zIndex: '10001', opacity: '1', transform: 'none' });
    // Fora do cartão do site, a ilustração ganha os cantos dele e perde a linha que a separa do texto.
    if (el.matches('.pillar__art')) Object.assign(el.style, { borderRadius: '16px', border: '1px solid var(--line)' });
    const back = document.createElement('div');
    back.id = 'readme-shot';
    Object.assign(back.style, { position: 'fixed', top: '0', left: '0', width: width + pad * 2 + 'px', height: el.getBoundingClientRect().height + pad * 2 + 'px', background: getComputedStyle(document.body).backgroundColor, zIndex: '10000' });
    document.body.append(back);
    return 1;
  })()" >/dev/null
  agent-browser screenshot "#readme-shot" "$out/$3" >/dev/null
  echo "$3"
}

capture '.app' 0 canvas.png
capture '.pillar__art' 0 status.png
capture '.pillar__art' 1 workspaces.png
capture '.pillar__art' 2 accounts.png
capture '.pillar__art' 3 agents.png
capture '.pillar__art' 4 global-agents.png
capture '.pillar__art' 5 terminals.png
capture '.pillar__art' 6 notes.png
capture '.rscene' 0 remote-access.png

agent-browser close --all >/dev/null
