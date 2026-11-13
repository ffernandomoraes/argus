const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// Fundo de caracteres ASCII que se mexe devagar, como uma névoa (hero, infra e rodapé).
const CHARS = ' .·:-=+*#%@'
function ascii(canvas) {
  const ctx = canvas.getContext('2d')
  const cell = 14
  let cols = 0
  let rows = 0
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `11px "Geist Mono", monospace`
    ctx.textBaseline = 'top'
    cols = Math.ceil(width / cell)
    rows = Math.ceil(height / cell)
  }
  function draw(t) {
    const { width, height } = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, width, height)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Ondas somadas: mais densas à direita e em cima, como no fundo da referência.
        const v =
          Math.sin(x * 0.11 + t * 0.0004) +
          Math.sin(y * 0.17 - t * 0.0003) +
          Math.sin((x + y) * 0.07 + t * 0.0002)
        const fade = (x / cols) * 0.9 + (1 - y / rows) * 0.4
        const n = ((v + 3) / 6) * fade
        const i = Math.max(0, Math.min(CHARS.length - 1, Math.floor(n * CHARS.length)))
        if (i === 0) continue
        ctx.fillStyle = `rgba(247,247,247,${0.05 + n * 0.22})`
        ctx.fillText(CHARS[i], x * cell, y * cell)
      }
    }
  }
  resize()
  addEventListener('resize', resize)
  if (reduceMotion) return draw(0)
  let visible = false
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas)
  let last = 0
  ;(function loop(t) {
    // ~20 quadros por segundo bastam e poupam a bateria.
    if (visible && t - last > 50) {
      draw(t)
      last = t
    }
    requestAnimationFrame(loop)
  })(0)
}
document.querySelectorAll('[data-ascii]').forEach(ascii)

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
  lit: [215, 117, 82] // laranja do logo
}

function rippleGrid(canvas) {
  const host = canvas.parentElement
  const ctx = canvas.getContext('2d')
  let w = 0
  let h = 0
  let points = []
  const waves = []
  const mouse = { x: 0, y: 0, in: false }
  let lastWave = 0

  const smooth = (t) => t * t * (3 - 2 * t)
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    w = host.clientWidth
    h = host.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    points = []
    const offX = (w % GRID.gap) / 2
    const offY = (h % GRID.gap) / 2
    for (let y = offY; y <= h; y += GRID.gap) for (let x = offX; x <= w; x += GRID.gap) points.push({ x, y })
    if (reduceMotion) draw()
  }

  function addWave(x, y) {
    waves.push({ x, y, r: 0, age: 0 })
    if (waves.length > 8) waves.shift()
  }

  // O canvas fica atrás do conteúdo (sem receber o mouse): a posição vem do hero inteiro.
  const local = (e) => {
    const box = canvas.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }
  host.addEventListener('pointermove', (e) => {
    Object.assign(mouse, local(e), { in: true })
    const now = performance.now()
    if (now - lastWave > 160) {
      addWave(mouse.x, mouse.y)
      lastWave = now
    }
  })
  host.addEventListener('pointerdown', (e) => {
    const p = local(e)
    addWave(p.x, p.y)
  })
  host.addEventListener('pointerleave', () => (mouse.in = false))

  function draw(step = 1) {
    ctx.clearRect(0, 0, w, h)
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i]
      wave.r += GRID.waveSpeed * step
      wave.age += step
      if (wave.age >= GRID.waveLife) waves.splice(i, 1)
    }
    for (const p of points) {
      let x = p.x
      let y = p.y
      // Atração do cursor: 1 em cima dele, 0 na borda do alcance.
      let near = 0
      if (mouse.in) {
        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const d = Math.hypot(dx, dy)
        if (d < GRID.reach && d > 0.01) {
          near = 1 - d / GRID.reach
          x += (dx / d) * near * GRID.pull
          y += (dy / d) * near * GRID.pull
        }
      }
      // Ondas: o ponto perto do anel é empurrado para fora.
      let wave = 0
      for (const wv of waves) {
        const dx = p.x - wv.x
        const dy = p.y - wv.y
        const d = Math.hypot(dx, dy)
        const off = Math.abs(d - wv.r)
        if (d < 0.01 || off > GRID.waveWidth) continue
        const k = (1 - smooth(off / GRID.waveWidth)) * (1 - smooth(wv.age / GRID.waveLife))
        wave = Math.max(wave, k)
        x += (dx / d) * k * GRID.wavePush * 0.35
        y += (dy / d) * k * GRID.wavePush * 0.35
      }
      const glow = Math.max(near, wave * 0.85)
      if (glow > 0.01) {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(x, y)
        ctx.strokeStyle = rgba(GRID.lit, glow * 0.4)
        ctx.lineWidth = 0.75 + glow * 0.8
        ctx.stroke()
      }
      const r = GRID.dot * (1 + glow * 0.5)
      if (glow > 0.05) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * (3 + glow * 4))
        halo.addColorStop(0, rgba(GRID.lit, 0.13 * glow))
        halo.addColorStop(1, rgba(GRID.lit, 0))
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, r * (3 + glow * 4), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = rgba(mix(GRID.rest, GRID.lit, glow), 0.45 + glow * 0.55)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Brilho suave em volta do cursor e o contorno de cada onda.
    if (mouse.in) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, GRID.reach * 0.5)
      g.addColorStop(0, rgba(GRID.lit, 0.07))
      g.addColorStop(1, rgba(GRID.lit, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(mouse.x, mouse.y, GRID.reach * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const wv of waves) {
      ctx.strokeStyle = rgba(GRID.lit, (1 - wv.age / GRID.waveLife) * 0.12)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  resize()
  new ResizeObserver(resize).observe(host)
  if (reduceMotion) return
  let visible = true
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host)
  let prev = performance.now()
  ;(function loop(now) {
    // Passo em quadros de 60 Hz, para a onda andar igual em telas de 120 Hz.
    const step = Math.min(now - prev, 50) / 16.67
    prev = now
    if (visible) draw(step)
    requestAnimationFrame(loop)
  })(prev)
}
document.querySelectorAll('[data-ripple-grid]').forEach(rippleGrid)

// Seção do fluxo: o Argus no centro e as seis etapas girando em volta dele. A etapa que passa pelo
// topo acende e aparece no texto ao lado.
const STEPS = [
  { title: 'Pedido', text: 'Escreva, cole um print ou dite o que precisa.', icon: '<path d="M4 5h16v11H9l-5 4z"/>' },
  { title: 'Plano', text: 'O agente lê o projeto e explica o que vai fazer.', icon: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>' },
  { title: 'Execução', text: 'Ferramentas e subagentes trabalham, e você vê cada passo.', icon: '<path d="M5 7l5 5-5 5M12.5 17H19"/>' },
  { title: 'Permissão', text: 'O que pede aprovação chega no chat. Você decide.', icon: '<path d="M12 3l7 3v5.5c0 4.3-3 7.6-7 9.5-4-1.9-7-5.2-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>' },
  { title: 'Revisão', text: 'O diff de cada arquivo editado, antes e depois.', icon: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M12 8.5v5M9.5 11h5M9.5 16.5h5"/>' },
  { title: 'Pronto', text: 'Notificação no sistema quando termina.', icon: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>' }
]

function orbit(el) {
  const card = el.closest('.cycle')
  const core = el.querySelector('.orbit__core')
  const PERIOD = 16000 // ms para uma volta inteira
  const items = STEPS.map((s) => {
    const item = document.createElement('span')
    item.className = 'orbit__item'
    item.title = s.title
    item.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${s.icon}</svg>`
    el.appendChild(item)
    return item
  })
  const num = card?.querySelector('[data-cycle-num]')
  const title = card?.querySelector('[data-cycle-title]')
  const text = card?.querySelector('[data-cycle-text]')
  let current = -1
  const show = (i) => {
    if (i === current) return
    current = i
    items.forEach((it, k) => it.classList.toggle('on', k === i))
    if (num) num.textContent = String(i + 1).padStart(2, '0')
    if (title) title.textContent = STEPS[i].title
    if (text) text.textContent = STEPS[i].text
  }

  // Posição de cada etapa no anel de fora: a etapa i começa no topo menos i * 60°, então, girando no
  // sentido horário, a seguinte chega ao topo logo depois dela.
  const place = (turn) => {
    const r = el.clientWidth / 2
    let top = 0
    let best = Infinity
    items.forEach((it, i) => {
      const deg = -90 - i * 60 + turn * 360
      const a = (deg * Math.PI) / 180
      it.style.transform = `translate(${(Math.cos(a) * r).toFixed(1)}px, ${(Math.sin(a) * r).toFixed(1)}px)`
      const fromTop = Math.abs(((((deg + 90) % 360) + 540) % 360) - 180)
      if (fromTop < best) {
        best = fromTop
        top = i
      }
    })
    show(top)
  }
  place(0)
  if (reduceMotion) return

  // O centro se inclina um pouco na direção do mouse.
  card?.addEventListener('pointermove', (e) => {
    const box = core.getBoundingClientRect()
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const d = Math.hypot(dx, dy) || 1
    const k = Math.min(1, d / 300) * 12
    core.style.transform = `translate(${((dx / d) * k).toFixed(1)}px, ${((dy / d) * k).toFixed(1)}px)`
  })
  card?.addEventListener('pointerleave', () => (core.style.transform = ''))

  let visible = false
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(el)
  let turn = 0
  let prev = performance.now()
  ;(function loop(now) {
    if (visible) {
      turn = (turn + (now - prev) / PERIOD) % 1
      place(turn)
    }
    prev = now
    requestAnimationFrame(loop)
  })(prev)
}
document.querySelectorAll('[data-orbit]').forEach(orbit)

// Seções aparecem ao entrar na tela.
const targets = document.querySelectorAll('.section .container > *, .outro__inner > *')
if (!reduceMotion) {
  targets.forEach((el) => el.classList.add('reveal'))
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      }
    },
    { threshold: 0.1 }
  )
  targets.forEach((el) => io.observe(el))
}

// Seção "Conecte com o que você já usa": piso de teclas inclinado com as ferramentas. Cada fileira
// anda como um letreiro (uma para cada lado) e o Argus fica parado e levantado no meio.
const STACK = ['github', 'git', 'modelcontextprotocol', 'nodedotjs', 'npm', 'pnpm', 'figma', 'notion', 'linear', 'docker', 'vercel', 'supabase', 'postgresql', 'ubuntu', 'gnubash', 'claude', 'openai', 'googlegemini', 'cursor']

function floor(el) {
  const plane = el.querySelector('.floor__plane')
  const ROWS = 11
  const PER_ROW = 18 // teclas em cada cópia da fileira (a fileira tem duas, para o loop não ter emenda)
  for (let r = 0; r < ROWS; r++) {
    const row = document.createElement('div')
    row.className = 'floor__row'
    // Velocidades um pouco diferentes, para as fileiras não andarem em bloco.
    row.style.setProperty('--dur', `${70 + ((r * 37) % 30)}s`)
    const tiles = Array.from({ length: PER_ROW }, (_, i) => STACK[(i * 3 + r * 7) % STACK.length])
    for (const name of [...tiles, ...tiles]) {
      const tile = document.createElement('span')
      tile.className = 'floor__tile'
      tile.innerHTML = `<img src="assets/stack/${name}.svg" alt="" loading="lazy">`
      row.appendChild(tile)
    }
    plane.appendChild(row)
  }
  const core = document.createElement('span')
  core.className = 'floor__core'
  core.innerHTML = '<img src="assets/icone-argus-laranja.svg" alt="">'
  plane.appendChild(core)
  if (reduceMotion) el.querySelectorAll('.floor__row').forEach((row) => (row.style.animation = 'none'))
}
document.querySelectorAll('[data-floor]').forEach(floor)

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
  color: '#f7f7f7' // todos os pontos na mesma cor (o desenho vem do formato da imagem)
}

function particles(canvas) {
  const ctx = canvas.getContext('2d')
  const img = new Image()
  let points = []
  let w = 0
  let h = 0
  const mouse = { x: -9999, y: -9999 }
  // Olho: os pontos da estrela (a pupila) olham para o mouse e piscam, como no ícone do Sobre.
  // Centro do círculo e quanto a pupila anda, em coordenadas do ícone (386 x 458).
  const EYE = { cx: 192.8, cy: 231.9, max: 46, w: 386 }
  const eye = { cx: 0, cy: 0, max: 0, x: 0, y: 0, tx: 0, ty: 0, blink: 1, next: 2500 }

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // A imagem ocupa 72% da altura, centralizada, com folga em volta para os pontos voarem.
    const ih = h * 0.72
    const iw = (img.naturalWidth / img.naturalHeight) * ih || ih
    const ox = (w - iw) / 2
    const oy = (h - ih) / 2
    const k = iw / EYE.w
    Object.assign(eye, { cx: ox + EYE.cx * k, cy: oy + EYE.cy * k, max: EYE.max * k })
    const off = document.createElement('canvas')
    off.width = Math.round(iw)
    off.height = Math.round(ih)
    const octx = off.getContext('2d', { willReadFrequently: true })
    octx.drawImage(img, 0, 0, off.width, off.height)
    const data = octx.getImageData(0, 0, off.width, off.height).data
    const old = points
    points = []
    for (let y = 0; y < off.height; y += PARTICLES.gap) {
      for (let x = 0; x < off.width; x += PARTICLES.gap) {
        const i = (y * off.width + x) * 4
        if (data[i + 3] < 128) continue
        const hx = ox + x
        const hy = oy + y
        const prev = old[points.length]
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
          seed: Math.random() * 1000
        })
      }
    }
    if (reduceMotion) for (const p of points) Object.assign(p, { x: p.hx, y: p.hy })
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h)
    eye.x += (eye.tx - eye.x) * 0.1
    eye.y += (eye.ty - eye.y) * 0.1
    if (t > eye.next) {
      const b = (t - eye.next) / 180
      eye.blink = b < 1 ? Math.abs(1 - 2 * b) * 0.9 + 0.1 : 1
      if (b >= 1) eye.next = t + 3000 + Math.random() * 3000
    }
    for (const p of points) {
      // Casa da pupila: deslocada para onde o olho olha e achatada na piscada.
      const homeX = p.pupil ? p.hx + eye.x : p.hx
      const homeY = p.pupil ? eye.cy + (p.hy - eye.cy) * eye.blink + eye.y : p.hy
      if (!reduceMotion) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < PARTICLES.reach && d > 0.01) {
          const f = (1 - d / PARTICLES.reach) * PARTICLES.push
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }
        // Volta para casa, com um tremor pequeno para nunca ficar parado de todo.
        const jx = Math.sin(t * 0.002 + p.seed) * 0.6
        const jy = Math.cos(t * 0.0023 + p.seed) * 0.6
        p.vx += (homeX + jx - p.x) * PARTICLES.spring
        p.vy += (homeY + jy - p.y) * PARTICLES.spring
        p.vx *= PARTICLES.friction
        p.vy *= PARTICLES.friction
        p.x += p.vx
        p.y += p.vy
      }
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, PARTICLES.size, PARTICLES.size)
    }
  }

  const local = (e) => {
    const box = canvas.getBoundingClientRect()
    mouse.x = e.clientX - box.left
    mouse.y = e.clientY - box.top
  }
  canvas.addEventListener('pointermove', local)
  canvas.addEventListener('pointerdown', local)
  canvas.addEventListener('pointerleave', () => Object.assign(mouse, { x: -9999, y: -9999 }))
  // Para onde o olho olha: o mouse em qualquer lugar da página.
  addEventListener('pointermove', (e) => {
    const box = canvas.getBoundingClientRect()
    const dx = e.clientX - (box.left + eye.cx)
    const dy = e.clientY - (box.top + eye.cy)
    const d = Math.hypot(dx, dy) || 1
    const k = Math.min(1, d / 400) * eye.max
    eye.tx = (dx / d) * k
    eye.ty = (dy / d) * k
  })
  document.addEventListener('pointerleave', () => Object.assign(eye, { tx: 0, ty: 0 }))

  img.onload = () => {
    build()
    new ResizeObserver(() => build()).observe(canvas)
    if (reduceMotion) return draw(0)
    let visible = false
    new IntersectionObserver(([e]) => {
      // Cada vez que o rodapé volta à tela, os pontos se espalham e se juntam de novo.
      if (e.isIntersecting && !visible) for (const p of points) Object.assign(p, { x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0 })
      visible = e.isIntersecting
    }).observe(canvas)
    ;(function loop(t) {
      if (visible) draw(t)
      requestAnimationFrame(loop)
    })(0)
  }
  img.src = canvas.dataset.src
}
document.querySelectorAll('[data-particles]').forEach(particles)

// Fileiras que andam em loop (mural de depoimentos). Com poucos cartões, eles se repetem até
// passar da largura de uma tela grande; depois o conjunto é copiado uma vez, e a animação anda
// metade da largura, então o fim de uma cópia encosta no começo da outra sem emenda.
document.querySelectorAll('[data-marquee]').forEach((track) => {
  const unit = [...track.children]
  const clone = (item) => {
    const copy = item.cloneNode(true)
    copy.setAttribute('aria-hidden', 'true')
    track.appendChild(copy)
  }
  while (track.scrollWidth < 2600) unit.forEach(clone)
  ;[...track.children].forEach(clone)
})

// Página de download: destaca o sistema de quem visita e troca os links pelos arquivos do último
// release (a API do GitHub). Sem a API, os botões continuam levando à página do release.
const download = document.querySelector('[data-download]')
if (download) {
  const ua = navigator.userAgent
  const os = /Windows/.test(ua) ? 'win' : /Mac/.test(ua) ? 'mac' : /Linux|X11/.test(ua) ? 'linux' : null
  const NAMES = { mac: 'macOS', win: 'Windows', linux: 'Linux' }
  const PICK = { mac: 'dmg', win: 'exe', linux: 'appimage' }
  const main = download.querySelector('[data-dl-main]')
  if (os) {
    download.querySelector(`.dl-card[data-os="${os}"]`)?.classList.add('is-mine')
    main.textContent = `Baixar para ${NAMES[os]}`
  }
  const MATCH = { dmg: /arm64\.dmg$/, zip: /arm64\.zip$/, exe: /Setup.*\.exe$/, appimage: /\.AppImage$/ }
  fetch('https://api.github.com/repos/ffernandomoraes/argus/releases/latest')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((rel) => {
      const urls = {}
      for (const [k, re] of Object.entries(MATCH)) {
        const a = rel.assets.find((x) => re.test(x.name))
        if (a) urls[k] = { href: a.browser_download_url, mb: Math.round(a.size / 1048576) }
      }
      document.querySelectorAll('[data-dl]').forEach((el) => {
        const u = urls[el.dataset.dl]
        if (!u) return
        el.href = u.href
        el.removeAttribute('target')
        if (el.classList.contains('btn')) el.textContent += ` · ${u.mb} MB`
      })
      if (os && urls[PICK[os]]) {
        main.href = urls[PICK[os]].href
        main.removeAttribute('target')
      }
      download.querySelector('[data-dl-version]').textContent = rel.tag_name
    })
    .catch(() => {})
}

// Abas do passo a passo e botão de copiar o comando.
document.querySelectorAll('.dl-tabs').forEach((tabs) => {
  const box = tabs.parentElement
  const show = (name) => {
    tabs.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)))
    box.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name))
  }
  tabs.addEventListener('click', (e) => e.target.dataset?.tab && show(e.target.dataset.tab))
  const ua = navigator.userAgent
  show(/Windows/.test(ua) ? 'win' : /Linux|X11/.test(ua) && !/Mac/.test(ua) ? 'linux' : 'mac')
})
document.querySelectorAll('[data-copy]').forEach((b) =>
  b.addEventListener('click', () => {
    navigator.clipboard.writeText(b.dataset.copy).then(() => {
      b.textContent = 'Copiado'
      setTimeout(() => (b.textContent = 'Copiar'), 1500)
    })
  })
)

// Atalhos: mostra as teclas do sistema de quem visita, com abas para trocar.
document.querySelectorAll('[data-keys]').forEach((box) => {
  const show = (os) => {
    box.dataset.os = os
    box.querySelectorAll('[data-os]').forEach((b) => b !== box && b.setAttribute('aria-selected', String(b.dataset.os === os)))
  }
  box.querySelector('.keys-os').addEventListener('click', (e) => e.target.dataset?.os && show(e.target.dataset.os))
  show(/Mac/.test(navigator.userAgent) ? 'mac' : 'win')
})

// Documentação: marca no índice a seção que está na tela.
const docSide = document.querySelector('.doc-side')
if (docSide) {
  const links = [...docSide.querySelectorAll('a[href^="#"]')]
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id))
    },
    { rootMargin: '-30% 0px -60% 0px' }
  )
  document.querySelectorAll('.doc-sec').forEach((s) => io.observe(s))
}

// Novidades: troca a lista pela dos releases mais recentes do GitHub (a do HTML fica de reserva).
const relList = document.querySelector('[data-releases]')
if (relList) {
  const TAGS = { FUNCIONALIDADE: ['Novo', 'new'], MELHORIA: ['Melhoria', 'imp'], BUG: ['Correção', 'fix'] }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  fetch('https://api.github.com/repos/ffernandomoraes/argus/releases?per_page=20')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((rels) => {
      const html = rels
        .map((r) => {
          const items = (r.body || '')
            .split('\n')
            .map((l) => l.match(/^\s*-\s*\[(FUNCIONALIDADE|MELHORIA|BUG)\]\s*(.+)$/))
            .filter(Boolean)
            .map((m) => `<li><span class="rel-tag rel-tag--${TAGS[m[1]][1]}">${TAGS[m[1]][0]}</span>${esc(m[2])}</li>`)
          if (!items.length) return ''
          const d = r.published_at.slice(0, 10).split('-').reverse().join('/')
          return `<article class="rel"><div class="rel__head"><a href="${r.html_url}" target="_blank" rel="noopener" class="rel__tag mono">${esc(r.tag_name)}</a><time>${d}</time></div><ul>${items.join('')}</ul></article>`
        })
        .join('')
      if (html) relList.innerHTML = html
    })
    .catch(() => {})
}

// Números reais do repositório: as estrelas no menu de todas as páginas e, na Comunidade, os
// números do topo e os contribuidores (sem os bots). Sem a API, fica o que veio no HTML.
{
  const repo = 'https://api.github.com/repos/ffernandomoraes/argus'
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject()))
  const fmt = (n) => (n >= 1000 ? (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K' : String(n))
  get(repo)
    .then((r) => {
      document.querySelectorAll('[data-stars]').forEach((el) => (el.textContent = fmt(r.stargazers_count)))
      document.querySelectorAll('[data-stat="stars"]').forEach((el) => (el.textContent = fmt(r.stargazers_count)))
      document.querySelectorAll('[data-stat="forks"]').forEach((el) => (el.textContent = fmt(r.forks_count)))
    })
    .catch(() => {})
  if (document.querySelector('[data-repo-stats]')) {
    // A API pagina de 100 em 100: com 100 na primeira página, há pelo menos isso.
    get(repo + '/releases?per_page=100')
      .then((list) => (document.querySelector('[data-stat="releases"]').textContent = list.length >= 100 ? '100+' : String(list.length)))
      .catch(() => {})
  }
  const people = document.querySelector('[data-contributors]')
  if (people) {
    get(repo + '/contributors?per_page=50')
      .then((list) => {
        const known = new Set(['ffernandomoraes'])
        for (const c of list) {
          if (c.type === 'Bot' || known.has(c.login)) continue
          const a = document.createElement('a')
          a.className = 'person'
          a.href = c.html_url
          a.target = '_blank'
          a.rel = 'noopener'
          a.innerHTML = `<img src="${c.avatar_url}&s=96" alt=""><strong></strong><span>${c.contributions} contribuições</span>`
          a.querySelector('strong').textContent = c.login
          people.appendChild(a)
        }
      })
      .catch(() => {})
  }
}

// Sobre: o ícone do Argus como um olho. O hexágono fica parado e a estrela (a pupila) olha para o
// mouse, sem passar da borda do círculo de dentro; de vez em quando ela pisca.
document.querySelectorAll('[data-eye]').forEach((box) => {
  const svg = box.querySelector('svg')
  const pupil = box.querySelector('.eye__pupil')
  const CENTER = { x: 192.8, y: 231.9 } // centro do círculo, nas coordenadas do SVG
  const MAX = 46 // quanto a pupila anda, antes de encostar na borda
  const target = { x: 0, y: 0 }
  const pos = { x: 0, y: 0 }
  let blink = 1
  addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect()
    const scale = r.width / 386
    const dx = e.clientX - (r.left + CENTER.x * scale)
    const dy = e.clientY - (r.top + CENTER.y * scale)
    const d = Math.hypot(dx, dy) || 1
    // Perto do ícone anda pouco; a partir de ~400px, vai até a borda.
    const k = Math.min(1, d / 400) * MAX
    target.x = (dx / d) * k
    target.y = (dy / d) * k
  })
  document.addEventListener('pointerleave', () => Object.assign(target, { x: 0, y: 0 }))
  if (reduceMotion) return
  let nextBlink = performance.now() + 2500
  ;(function loop(now) {
    // Segue o mouse com atraso suave.
    pos.x += (target.x - pos.x) * 0.12
    pos.y += (target.y - pos.y) * 0.12
    // Piscar: fecha e abre em ~180ms, a cada 3 a 6 segundos.
    if (now > nextBlink) {
      const t = (now - nextBlink) / 180
      blink = t < 1 ? Math.abs(1 - 2 * t) * 0.9 + 0.1 : 1
      if (t >= 1) nextBlink = now + 3000 + Math.random() * 3000
    }
    pupil.setAttribute('transform', `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)}) translate(${CENTER.x} ${CENTER.y}) scale(1 ${blink.toFixed(3)}) translate(${-CENTER.x} ${-CENTER.y})`)
    requestAnimationFrame(loop)
  })(performance.now())
})

// Ajuda: busca e filtro por assunto nos cartões dos tutoriais.
document.querySelectorAll('[data-help]').forEach((box) => {
  const cards = [...box.querySelectorAll('.tcard')]
  const input = box.querySelector('[data-help-search]')
  const empty = box.querySelector('[data-help-empty]')
  const buttons = [...box.querySelectorAll('[data-filter]')]
  let cat = ''
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const apply = () => {
    const q = norm(input.value.trim())
    let shown = 0
    for (const c of cards) {
      const ok = (!cat || c.dataset.cat === cat) && (!q || norm(c.textContent).includes(q))
      c.hidden = !ok
      if (ok) shown++
    }
    empty.hidden = shown > 0
  }
  input.addEventListener('input', apply)
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      cat = b.dataset.filter
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      apply()
    })
  )
})
