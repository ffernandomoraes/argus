# Argus - site

Landing page do Argus. HTML, CSS e JS puros: para trabalhar, é só abrir o `index.html` ou servir a
pasta (`python3 -m http.server` aqui dentro).

Na publicação, o `wrangler deploy` roda o `build.mjs` antes ([build] no `wrangler.toml`): ele copia o
site para `dist/` (fora do git) e coloca o CSS dentro de cada HTML, para o navegador desenhar a tela
sem esperar outro arquivo. É o que publica e o que dá 100 no PageSpeed no celular. Só vai o que está
na lista do `build.mjs` (páginas, scripts, estilos, imagens, fontes com a licença e o `_headers`):
arquivo novo de outro tipo precisa entrar na lista, e `.env`, anotações e afins nunca sobem.

`_headers`: cabeçalhos de segurança de todas as páginas (HSTS, nosniff, sem iframe de outros sites). A
CSP não limita scripts por causa do Google Tag Manager, que carrega o que estiver configurado no
painel dele.

O conteúdo (páginas, textos, imagens, vídeos, `styles.css` e `script.js`) é a proposta do Jota, 100% como
está no fork dele (`jotaandrade/argus`, branch `website`, 31/10/2026; issue #6), republicada em
2026-11-25 a pedido do Fernando no lugar da versão enxuta. Inclui o Modo design de propósito, mesmo
fora do app. Por baixo, só mudou o que não aparece:
- `script.js` busca os dados do GitHub em `/api/github/*` (o `worker.js`: `repo`, `latest`, `releases`,
  `releaseCount`, `contributors`), não direto no `api.github.com` (limite de 60 por hora por IP gera 403).
- `build.mjs` publica também `ajuda/`, `blog/` e os vídeos `.mp4`, coloca o CSS dentro de cada página e
  insere o Google Tag Manager (GTM-MQVZGP55), para o HTML ficar igual ao do Jota.
- `script.js` passou pelo `eslint --fix` (ponto e vírgula, aspas), sem mudar o comportamento.

Mudanças aqui não disparam o release do app: o site tem o `website.yml` (`apps/website/**` está no
`paths-ignore` do `release.yml`).
