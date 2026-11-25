const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fundo de caracteres ASCII que se mexe devagar, como uma névoa (hero, infra e rodapé).
const CHARS = ' .·:-=+*#%@';
function ascii(canvas) {
  const ctx = canvas.getContext('2d');
  const cell = 14;
  let cols = 0;
  let rows = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '11px "Geist Mono", monospace';
    ctx.textBaseline = 'top';
    cols = Math.ceil(width / cell);
    rows = Math.ceil(height / cell);
  }
  function draw(t) {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Ondas somadas: mais densas à direita e em cima, como no fundo da referência.
        const v =
          Math.sin(x * 0.11 + t * 0.0004) +
          Math.sin(y * 0.17 - t * 0.0003) +
          Math.sin((x + y) * 0.07 + t * 0.0002);
        const fade = (x / cols) * 0.9 + (1 - y / rows) * 0.4;
        const n = ((v + 3) / 6) * fade;
        const i = Math.max(0, Math.min(CHARS.length - 1, Math.floor(n * CHARS.length)));
        if (i === 0) continue;
        ctx.fillStyle = `rgba(247,247,247,${0.05 + n * 0.22})`;
        ctx.fillText(CHARS[i], x * cell, y * cell);
      }
    }
  }
  resize();
  addEventListener('resize', resize);
  if (reduceMotion) return draw(0);
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let last = 0;
  (function loop(t) {
    // ~20 quadros por segundo bastam e poupam a bateria.
    if (visible && t - last > 50) {
      draw(t);
      last = t;
    }
    requestAnimationFrame(loop);
  })(0);
}
document.querySelectorAll('[data-ascii]').forEach(ascii);

// Fundo do hero: grade de pontos que o cursor atrai. Perto do mouse os pontos crescem, acendem em
// laranja e deixam uma linha até o lugar de origem; mexer o mouse ou clicar solta uma onda que
// empurra os pontos para fora enquanto se espalha.
const GRID = {
  gap: 34, // distância entre os pontos
  dot: 1, // raio do ponto parado (2px de diâmetro)
  reach: 190, // até onde o cursor atrai
  pull: 22, // quanto o ponto anda na direção do cursor
  waveSpeed: 4.2, // px por quadro
  waveWidth: 110, // espessura do anel da onda
  wavePush: 14, // quanto a onda empurra
  waveLife: 110, // quadros até a onda sumir
  rest: [58, 58, 58], // cor do ponto parado
  lit: [215, 117, 82], // laranja do logo
};

function rippleGrid(canvas) {
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let points = [];
  const waves = [];
  const mouse = { x: 0, y: 0, in: false };
  let lastWave = 0;

  const smooth = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    points = [];
    const offX = (w % GRID.gap) / 2;
    const offY = (h % GRID.gap) / 2;
    for (let y = offY; y <= h; y += GRID.gap) for (let x = offX; x <= w; x += GRID.gap) points.push({ x, y });
    if (reduceMotion) draw();
  }

  function addWave(x, y) {
    waves.push({ x, y, r: 0, age: 0 });
    if (waves.length > 8) waves.shift();
  }

  // O canvas fica atrás do conteúdo (sem receber o mouse): a posição vem do hero inteiro.
  const local = (e) => {
    const box = canvas.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  host.addEventListener('pointermove', (e) => {
    Object.assign(mouse, local(e), { in: true });
    const now = performance.now();
    if (now - lastWave > 160) {
      addWave(mouse.x, mouse.y);
      lastWave = now;
    }
  });
  host.addEventListener('pointerdown', (e) => {
    const p = local(e);
    addWave(p.x, p.y);
  });
  host.addEventListener('pointerleave', () => (mouse.in = false));

  function draw(step = 1) {
    ctx.clearRect(0, 0, w, h);
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i];
      wave.r += GRID.waveSpeed * step;
      wave.age += step;
      if (wave.age >= GRID.waveLife) waves.splice(i, 1);
    }
    for (const p of points) {
      let x = p.x;
      let y = p.y;
      // Atração do cursor: 1 em cima dele, 0 na borda do alcance.
      let near = 0;
      if (mouse.in) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < GRID.reach && d > 0.01) {
          near = 1 - d / GRID.reach;
          x += (dx / d) * near * GRID.pull;
          y += (dy / d) * near * GRID.pull;
        }
      }
      // Ondas: o ponto perto do anel é empurrado para fora.
      let wave = 0;
      for (const wv of waves) {
        const dx = p.x - wv.x;
        const dy = p.y - wv.y;
        const d = Math.hypot(dx, dy);
        const off = Math.abs(d - wv.r);
        if (d < 0.01 || off > GRID.waveWidth) continue;
        const k = (1 - smooth(off / GRID.waveWidth)) * (1 - smooth(wv.age / GRID.waveLife));
        wave = Math.max(wave, k);
        x += (dx / d) * k * GRID.wavePush * 0.35;
        y += (dy / d) * k * GRID.wavePush * 0.35;
      }
      const glow = Math.max(near, wave * 0.85);
      if (glow > 0.01) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = rgba(GRID.lit, glow * 0.4);
        ctx.lineWidth = 0.75 + glow * 0.8;
        ctx.stroke();
      }
      const r = GRID.dot * (1 + glow * 0.5);
      if (glow > 0.05) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * (3 + glow * 4));
        halo.addColorStop(0, rgba(GRID.lit, 0.13 * glow));
        halo.addColorStop(1, rgba(GRID.lit, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, r * (3 + glow * 4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rgba(mix(GRID.rest, GRID.lit, glow), 0.45 + glow * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Brilho suave em volta do cursor e o contorno de cada onda.
    if (mouse.in) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, GRID.reach * 0.5);
      g.addColorStop(0, rgba(GRID.lit, 0.07));
      g.addColorStop(1, rgba(GRID.lit, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, GRID.reach * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const wv of waves) {
      ctx.strokeStyle = rgba(GRID.lit, (1 - wv.age / GRID.waveLife) * 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  resize();
  new ResizeObserver(resize).observe(host);
  if (reduceMotion) return;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);
  let prev = performance.now();
  (function loop(now) {
    // Passo em quadros de 60 Hz, para a onda andar igual em telas de 120 Hz.
    const step = Math.min(now - prev, 50) / 16.67;
    prev = now;
    if (visible) draw(step);
    requestAnimationFrame(loop);
  })(prev);
}
document.querySelectorAll('[data-ripple-grid]').forEach(rippleGrid);

// Seções aparecem ao entrar na tela.
const targets = document.querySelectorAll('.section .container > *, .outro__inner > *');
if (!reduceMotion) {
  targets.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { threshold: 0.1 },
  );
  targets.forEach((el) => io.observe(el));
}

// Rodapé: o ícone do Argus feito de partículas brancas, com o formato da imagem, olhando para o mouse; o cursor
// empurra os pontos, que voltam ao lugar como molas e tremem de leve mesmo parados. Ao aparecer na
// tela, os pontos chegam espalhados e se juntam.
const PARTICLES = {
  gap: 6, // de quantos em quantos pixels da imagem sai um ponto
  size: 2.6, // lado do ponto
  reach: 130, // raio de alcance do cursor
  push: 6, // força do empurrão
  spring: 0.045, // força que puxa o ponto de volta
  friction: 0.86,
  color: '#f7f7f7', // todos os pontos na mesma cor (o desenho vem do formato da imagem)
};

function particles(canvas) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  let points = [];
  let w = 0;
  let h = 0;
  const mouse = { x: -9999, y: -9999 };
  // Olho: os pontos da estrela (a pupila) olham para o mouse e piscam, como no ícone do Sobre.
  // Centro do círculo e quanto a pupila anda, em coordenadas do ícone (386 x 458).
  const EYE = { cx: 192.8, cy: 231.9, max: 46, w: 386 };
  const eye = { cx: 0, cy: 0, max: 0, x: 0, y: 0, tx: 0, ty: 0, blink: 1, next: 2500 };

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A imagem ocupa 72% da altura, centralizada, com folga em volta para os pontos voarem.
    const ih = h * 0.72;
    const iw = (img.naturalWidth / img.naturalHeight) * ih || ih;
    const ox = (w - iw) / 2;
    const oy = (h - ih) / 2;
    const k = iw / EYE.w;
    Object.assign(eye, { cx: ox + EYE.cx * k, cy: oy + EYE.cy * k, max: EYE.max * k });
    const off = document.createElement('canvas');
    off.width = Math.round(iw);
    off.height = Math.round(ih);
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, off.width, off.height);
    const data = octx.getImageData(0, 0, off.width, off.height).data;
    const old = points;
    points = [];
    for (let y = 0; y < off.height; y += PARTICLES.gap) {
      for (let x = 0; x < off.width; x += PARTICLES.gap) {
        const i = (y * off.width + x) * 4;
        if (data[i + 3] < 128) continue;
        const hx = ox + x;
        const hy = oy + y;
        const prev = old[points.length];
        points.push({
          hx,
          hy,
          // Começam espalhados (ou onde estavam, num redimensionamento).
          x: prev ? prev.x : Math.random() * w,
          y: prev ? prev.y : Math.random() * h,
          vx: 0,
          vy: 0,
          color: PARTICLES.color,
          // Pixel claro é da estrela; o laranja é o hexágono.
          pupil: data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200,
          seed: Math.random() * 1000,
        });
      }
    }
    if (reduceMotion) for (const p of points) Object.assign(p, { x: p.hx, y: p.hy });
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    eye.x += (eye.tx - eye.x) * 0.1;
    eye.y += (eye.ty - eye.y) * 0.1;
    if (t > eye.next) {
      const b = (t - eye.next) / 180;
      eye.blink = b < 1 ? Math.abs(1 - 2 * b) * 0.9 + 0.1 : 1;
      if (b >= 1) eye.next = t + 3000 + Math.random() * 3000;
    }
    for (const p of points) {
      // Casa da pupila: deslocada para onde o olho olha e achatada na piscada.
      const homeX = p.pupil ? p.hx + eye.x : p.hx;
      const homeY = p.pupil ? eye.cy + (p.hy - eye.cy) * eye.blink + eye.y : p.hy;
      if (!reduceMotion) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < PARTICLES.reach && d > 0.01) {
          const f = (1 - d / PARTICLES.reach) * PARTICLES.push;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        // Volta para casa, com um tremor pequeno para nunca ficar parado de todo.
        const jx = Math.sin(t * 0.002 + p.seed) * 0.6;
        const jy = Math.cos(t * 0.0023 + p.seed) * 0.6;
        p.vx += (homeX + jx - p.x) * PARTICLES.spring;
        p.vy += (homeY + jy - p.y) * PARTICLES.spring;
        p.vx *= PARTICLES.friction;
        p.vy *= PARTICLES.friction;
        p.x += p.vx;
        p.y += p.vy;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, PARTICLES.size, PARTICLES.size);
    }
  }

  const local = (e) => {
    const box = canvas.getBoundingClientRect();
    mouse.x = e.clientX - box.left;
    mouse.y = e.clientY - box.top;
  };
  canvas.addEventListener('pointermove', local);
  canvas.addEventListener('pointerdown', local);
  canvas.addEventListener('pointerleave', () => Object.assign(mouse, { x: -9999, y: -9999 }));
  // Para onde o olho olha: o mouse em qualquer lugar da página.
  addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect();
    const dx = e.clientX - (box.left + eye.cx);
    const dy = e.clientY - (box.top + eye.cy);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 400) * eye.max;
    eye.tx = (dx / d) * k;
    eye.ty = (dy / d) * k;
  });
  document.addEventListener('pointerleave', () => Object.assign(eye, { tx: 0, ty: 0 }));

  img.onload = () => {
    build();
    new ResizeObserver(() => build()).observe(canvas);
    if (reduceMotion) return draw(0);
    let visible = false;
    new IntersectionObserver(([e]) => {
      // Cada vez que o rodapé volta à tela, os pontos se espalham e se juntam de novo.
      if (e.isIntersecting && !visible) for (const p of points) Object.assign(p, { x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0 });
      visible = e.isIntersecting;
    }).observe(canvas);
  (function loop(t) {
      if (visible) draw(t);
      requestAnimationFrame(loop);
    })(0);
  };
  img.src = canvas.dataset.src;
}
document.querySelectorAll('[data-particles]').forEach(particles);

// Fileiras que andam em loop (mural de depoimentos). Com poucos cartões, eles se repetem até
// passar da largura de uma tela grande; depois o conjunto é copiado uma vez, e a animação anda
// metade da largura, então o fim de uma cópia encosta no começo da outra sem emenda.
document.querySelectorAll('[data-marquee]').forEach((track) => {
  const unit = [...track.children];
  const clone = (item) => {
    const copy = item.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true; // the copy's links stay out of the Tab order
    track.appendChild(copy);
  };
  while (track.scrollWidth < 2600) unit.forEach(clone);
  [...track.children].forEach(clone);
});

// Página de download: destaca o sistema de quem visita e troca os links pelos arquivos do último
// release (a API do GitHub). Sem a API, os botões continuam levando à página do release.
const download = document.querySelector('[data-download]');
if (download) {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? 'win' : /Mac/.test(ua) ? 'mac' : /Linux|X11/.test(ua) ? 'linux' : null;
  const NAMES = { mac: 'macOS', win: 'Windows', linux: 'Linux' };
  const PICK = { mac: 'dmg', win: 'exe', linux: 'appimage' };
  const main = download.querySelector('[data-dl-main]');
  if (os) {
    download.querySelector(`.dl-card[data-os="${os}"]`)?.classList.add('is-mine');
    main.textContent = `Baixar para ${NAMES[os]}`;
  }
  const MATCH = { dmg: /arm64\.dmg$/, zip: /arm64\.zip$/, exe: /Setup.*\.exe$/, appimage: /\.AppImage$/ };
  fetch('/api/github/latest')
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      if (!rel) return;
      const urls = {};
      for (const [k, re] of Object.entries(MATCH)) {
        const a = rel.assets.find((x) => re.test(x.name));
        if (a) urls[k] = { href: a.browser_download_url, mb: Math.round(a.size / 1048576) };
      }
      document.querySelectorAll('[data-dl]').forEach((el) => {
        const u = urls[el.dataset.dl];
        if (!u) return;
        el.href = u.href;
        el.removeAttribute('target');
        if (el.classList.contains('btn')) el.textContent += ` - ${u.mb} MB`;
      });
      if (os && urls[PICK[os]]) {
        main.href = urls[PICK[os]].href;
        main.removeAttribute('target');
      }
      const version = download.querySelector('[data-dl-version]');
      if (version) version.textContent = rel.tag_name;
    })
    .catch(() => {});
}

// Abas do passo a passo e botão de copiar o comando.
document.querySelectorAll('.dl-tabs').forEach((tabs) => {
  const box = tabs.parentElement;
  const show = (name) => {
    tabs.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    box.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
  };
  tabs.addEventListener('click', (e) => e.target.dataset?.tab && show(e.target.dataset.tab));
  const ua = navigator.userAgent;
  show(/Windows/.test(ua) ? 'win' : /Linux|X11/.test(ua) && !/Mac/.test(ua) ? 'linux' : 'mac');
});
document.querySelectorAll('[data-copy]').forEach((b) =>
  b.addEventListener('click', () => {
    navigator.clipboard.writeText(b.dataset.copy).then(() => {
      b.textContent = 'Copiado';
      setTimeout(() => (b.textContent = 'Copiar'), 1500);
    });
  }),
);

// Novidades: troca a lista pela dos releases mais recentes do GitHub (a do HTML fica de reserva).
const relList = document.querySelector('[data-releases]');
if (relList) {
  const TAGS = { FUNCIONALIDADE: ['Novo', 'new'], MELHORIA: ['Melhoria', 'imp'], BUG: ['Correção', 'fix'] };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  fetch('/api/github/releases')
    .then((r) => (r.ok ? r.json() : null))
    .then((rels) => {
      if (!rels) return;
      const html = rels
        .map((r) => {
          const items = (r.body || '')
            .split('\n')
            .map((l) => l.match(/^\s*-\s*\[(FUNCIONALIDADE|MELHORIA|BUG)\]\s*(.+)$/))
            .filter(Boolean)
            .map((m) => `<li><span class="rel-tag rel-tag--${TAGS[m[1]][1]}">${TAGS[m[1]][0]}</span>${esc(m[2])}</li>`);
          if (!items.length) return '';
          const d = r.published_at.slice(0, 10).split('-').reverse().join('/');
          return `<article class="rel"><div class="rel__head"><a href="${r.html_url}" target="_blank" rel="noopener" class="rel__tag mono">${esc(r.tag_name)}</a><time>${d}</time></div><ul>${items.join('')}</ul></article>`;
        })
        .join('');
      if (html) relList.innerHTML = html;
    })
    .catch(() => {});
}

// Estrelas do repositório no menu de todas as páginas. Sem a API, fica o que veio no HTML.
// As três consultas ao GitHub passam pelo worker.js, que guarda a resposta (limite de 60 por hora).
fetch('/api/github/repo')
  .then((r) => (r.ok ? r.json() : null))
  .then((repo) => {
    if (!repo) return;
    const n = repo.stargazers_count;
    const text = n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K' : String(n);
    document.querySelectorAll('[data-stars]').forEach((el) => (el.textContent = text));
  })
  .catch(() => {});
