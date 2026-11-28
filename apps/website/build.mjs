// Builds the published copy of the site into dist/. The source stays plain HTML/CSS (open
// index.html directly to work on it); the only change here is inlining each page's stylesheets,
// so the browser can paint without waiting for extra CSS requests (render-blocking on mobile).
// Runs automatically on `wrangler deploy` ([build] in wrangler.toml).
//
// What goes live is a list of what may go, not of what may not: the pages, their scripts and
// styles, images, fonts (with their licenses) and the Cloudflare headers file. Anything else in this
// folder (README, build.mjs, worker.js, wrangler.toml, package files, dotfiles such as .env or
// .dev.vars, notes) never reaches dist/, even if someone drops it here by mistake.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = import.meta.dirname;
const out = join(root, 'dist');

const isRootFile = (name) => name !== 'worker.js' && /^(?:[\w-]+\.(?:html|css|js)|_headers|_redirects|robots\.txt|sitemap\.xml)$/.test(name);
const ASSET_DIRS = ['assets'];
const PAGE_DIRS = ['help', 'blog', 'pt']; // pt/ tem a versão em português, com pt/ajuda e pt/blog
const isAssetFile = (name) => /\.(?:svg|png|webp|jpe?g|gif|ico|avif|mp4|woff2?)$/i.test(name) || /^OFL[\w-]*\.txt$/.test(name);
const isPageFile = (name) => /^[\w-]+\.html$/.test(name);

// Real files only: symlinks and dotfiles are skipped, so nothing from outside the folder sneaks in.
function copyMatching(from, to, accept) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const source = join(from, entry.name);
    if (entry.isDirectory()) copyMatching(source, join(to, entry.name), accept);
    else if (entry.isFile() && accept(entry.name)) {
      mkdirSync(to, { recursive: true });
      copyFileSync(source, join(to, entry.name));
    }
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && isRootFile(entry.name)) copyFileSync(join(root, entry.name), join(out, entry.name));
}
for (const dir of ASSET_DIRS) copyMatching(join(root, dir), join(out, dir), isAssetFile);
for (const dir of PAGE_DIRS) copyMatching(join(root, dir), join(out, dir), isPageFile);

// Pages in subfolders (help/, blog/, pt/, pt/ajuda/…) point to ../styles.css or ../../styles.css; the
// stylesheet always lives at the root.
// Relative url() inside the CSS (fonts) would then resolve from the subfolder, so they become absolute.
const stylesheet = /<link rel="stylesheet" href="(?:\.\.\/)*([\w-]+\.css)">/g;
const inlineCss = (href) => readFileSync(join(root, href), 'utf8').replace(/url\((['"]?)(?!\/|data:|https?:)/g, 'url($1/');
// Google Tag Manager, added here so the page sources stay exactly as designed.
const GTM = `<meta charset="utf-8">
  <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-MQVZGP55"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
  </script>`;
const pages = readdirSync(out, { recursive: true }).filter((path) => isPageFile(basename(path)));
for (const page of pages) {
  const file = join(out, page);
  const html = readFileSync(file, 'utf8')
    .replace(stylesheet, (_, href) => `<style>\n${inlineCss(href)}</style>`)
    .replace('<meta charset="utf-8">', GTM);
  writeFileSync(file, html);
}
process.stdout.write('Site built in dist/\n');
