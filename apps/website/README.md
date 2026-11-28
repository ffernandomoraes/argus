# Argus - site

Landing page do Argus. HTML, CSS e JS puros: para trabalhar, é só abrir o `index.html` ou servir a
pasta (`python3 -m http.server` aqui dentro).

Na publicação, o `wrangler deploy` roda o `build.mjs` antes ([build] no `wrangler.toml`): ele copia o
site para `dist/` (fora do git) e coloca o CSS dentro de cada HTML, para o navegador desenhar a tela
sem esperar outro arquivo. É o que publica e o que dá 100 no PageSpeed no celular. Só vai o que está
na lista do `build.mjs` (páginas, scripts, estilos, imagens, fontes com a licença e o `_headers`):
arquivo novo de outro tipo precisa entrar na lista, e `.env`, anotações e afins nunca sobem.

## Idiomas

- **Inglês** (padrão) fica na raiz: `index.html`, `about.html`, `help/`, `blog/`…
- **Português** fica em `pt/`, com os nomes de arquivo em português: `pt/sobre.html`, `pt/ajuda/`, `pt/blog/`…

Cada página aponta para a versão no outro idioma pelo botão EN/PT do menu e pelos
`<link rel="alternate" hreflang>` do `<head>`. Ao criar ou renomear uma página, faça as duas versões
e acerte esses links nos dois lados. `styles.css`, `script.js` e `assets/` são compartilhados: o
`script.js` lê o `lang` do `<html>` para escolher os textos que ele mesmo escreve. As Novidades em
inglês ficam com a lista do HTML, porque as notas dos releases são escritas em português.

`_redirects`: os endereços antigos, de quando o site era só em português (`/sobre.html`,
`/ajuda/...`, `/blog/por-que-um-canvas.html`…), levam à mesma página em `/pt/`. Os que têm o mesmo
nome nos dois idiomas (`index`, `canvas`, `download`, `docs`, `blog`) abrem em inglês.

`_headers`: cabeçalhos de segurança de todas as páginas (HSTS, nosniff, sem iframe de outros sites). A
CSP não limita scripts por causa do Google Tag Manager, que carrega o que estiver configurado no
painel dele.

O conteúdo (páginas, textos, imagens, vídeos, `styles.css` e `script.js`) é a proposta do Jota, 100% como
está no fork dele (`jotaandrade/argus`, branch `website`, 31/10/2026; issue #6), republicada em
2026-11-25 a pedido do Fernando no lugar da versão enxuta. Inclui o Modo design de propósito, mesmo
fora do app. Em 2026-11-28 ganhou a versão em inglês como padrão (a do fork, commit 7421c23), com o
português em `pt/`. Por baixo, só mudou o que não aparece:
- `script.js` busca os dados do GitHub em `/api/github/*` (o `worker.js`: `repo`, `latest`, `releases`,
  `releaseCount`, `contributors`), não direto no `api.github.com` (limite de 60 por hora por IP gera 403).
- `build.mjs` publica também `help/`, `blog/`, `pt/` e os vídeos `.mp4`, coloca o CSS dentro de cada página e
  insere o Google Tag Manager (GTM-MQVZGP55), para o HTML ficar igual ao do Jota.
- `script.js` passou pelo `eslint --fix` (ponto e vírgula, aspas), sem mudar o comportamento.

Mudanças aqui não disparam o release do app: o site tem o `website.yml` (`apps/website/**` está no
`paths-ignore` do `release.yml`).
