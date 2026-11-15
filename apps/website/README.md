# Argus - site

Landing page do Argus. HTML, CSS e JS puros, sem build: é só abrir o `index.html` ou servir a pasta
(`python3 -m http.server` aqui dentro).

- `index.html` + `home.css`: a home. As imagens do app são ilustrações em HTML/CSS, não prints; ao
  mudar o app, ajuste o desenho.
- `download.html`, `novidades.html` (lê os releases do GitHub), `privacidade.html`.
- `styles.css` e `script.js`: o que as páginas dividem.

Partiu da proposta do Jota (issue #6, fork `jotaandrade/argus`, branch `website`), enxugada em
2026-11-15 para o que o projeto tem de verdade: sem blog, central de ajuda nem página para times.
Mudanças aqui não disparam o release do app (`apps/website/**` está no `paths-ignore` do `release.yml`).
