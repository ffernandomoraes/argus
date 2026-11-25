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

Desempenho (PageSpeed 100 em 2026-11-23), para não perder:
- Fontes em `assets/fonts` já recortadas: só pesos 400 a 700 (o site usa 400, 500 e 600) e a Geist
  Mono só com latim e setas. Trocar ou adicionar fonte: refazer o recorte com o fontTools
  (`pyftsubset` para os caracteres, `fonttools varLib.instancer <arquivo> wght=400:700` para os pesos).
- Imagens com `width`/`height` no HTML e texto com contraste de 4,5:1 (`--faint` é o mais claro que
  passa no fundo #262626).
- Títulos em ordem (h1, h2, h3, sem pular nível).
- Nada de chamar `api.github.com` direto do navegador: o limite é de 60 consultas por hora por IP, e os
  servidores do PageSpeed estouram, gerando 403 no console. O `worker.js` responde `/api/github/repo`,
  `/latest` e `/releases`, guarda a resposta por 10 minutos e, se o GitHub falhar, devolve a última cópia.
- Links dentro de texto sublinhados (a cor sozinha não basta).

- `index.html` + `home.css`: a home. As imagens do app são ilustrações em HTML/CSS, não prints; ao
  mudar o app, ajuste o desenho.
- `download.html`, `novidades.html` (lê os releases do GitHub), `privacidade.html`.
- `styles.css` e `script.js`: o que as páginas dividem.

Partiu da proposta do Jota (issue #6, fork `jotaandrade/argus`, branch `website`), enxugada em
2026-11-15 para o que o projeto tem de verdade: sem blog, central de ajuda nem página para times.
Mudanças aqui não disparam o release do app (`apps/website/**` está no `paths-ignore` do `release.yml`).
