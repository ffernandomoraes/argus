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
import { join } from 'node:path';

const root = import.meta.dirname;
const out = join(root, 'dist');

const isRootFile = (name) => name !== 'worker.js' && /^(?:[\w-]+\.(?:html|css|js)|_headers|robots\.txt|sitemap\.xml)$/.test(name);
const ASSET_DIRS = ['assets'];
const isAssetFile = (name) => /\.(?:svg|png|webp|jpe?g|gif|ico|avif|woff2?)$/i.test(name) || /^OFL[\w-]*\.txt$/.test(name);

// Real files only: symlinks and dotfiles are skipped, so nothing from outside the folder sneaks in.
function copyAssets(from, to) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const source = join(from, entry.name);
    if (entry.isDirectory()) copyAssets(source, join(to, entry.name));
    else if (entry.isFile() && isAssetFile(entry.name)) {
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
for (const dir of ASSET_DIRS) copyAssets(join(root, dir), join(out, dir));

const stylesheet = /<link rel="stylesheet" href="([\w-]+\.css)">/g;
for (const page of readdirSync(out).filter((name) => name.endsWith('.html'))) {
  const file = join(out, page);
  const html = readFileSync(file, 'utf8').replace(stylesheet, (_, href) => {
    const css = readFileSync(join(root, href), 'utf8');
    return `<style>\n${css}</style>`;
  });
  writeFileSync(file, html);
}
process.stdout.write('Site built in dist/\n');
