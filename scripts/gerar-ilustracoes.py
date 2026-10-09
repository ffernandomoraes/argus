# Ilustrações do README (docs/ilustracoes/*.svg): esquemas do app, não prints. Cada SVG troca
# sozinho entre claro e escuro pelo prefers-color-scheme, como o GitHub mostra.
# Rodar: python3 scripts/gerar-ilustracoes.py
import os, sys
from xml.sax.saxutils import escape

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'docs', 'ilustracoes')
os.makedirs(OUT, exist_ok=True)

TRAB, PESS, FREELA = '#3b82f6', '#10b981', '#f59e0b'
RED = '#ef4444'

STYLE = """<style>
svg{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
--bg:#ececec;--surface:#fff;--surface2:#ebebeb;--line:#dedede;--line2:#c6c6c6;--text:#1d1d1f;--muted:#6e6e73;
--faint:#8e8e93;--dots:#c4c4c4;--accent:#0a84ff;--run:#2563eb;--need:#d97706;--done:#059669;--add:#dcfce7;--del:#fee2e2;
--addtx:#047857;--deltx:#b91c1c;--shadow:#000;--shadowop:.10}
@media (prefers-color-scheme:dark){svg{--bg:#1c1c1c;--surface:#282828;--surface2:#333;--line:#3a3a3a;--line2:#4c4c4c;
--text:#f4f4f4;--muted:#a5a5a5;--faint:#7a7a7a;--dots:#3c3c3c;--run:#60a5fa;--need:#fbbf24;--done:#34d399;
--add:#10391f;--del:#3f1d1d;--addtx:#6ee7b7;--deltx:#fca5a5;--shadowop:.45}}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
.bg{fill:var(--bg)}.sf{fill:var(--surface);stroke:var(--line)}.sf2{fill:var(--surface);stroke:var(--line2)}
.s2{fill:var(--surface2)}.sl{stroke:var(--line)}.sl2{stroke:var(--line2)}.tx{fill:var(--text)}.mu{fill:var(--muted)}
.fa{fill:var(--faint)}.dot{fill:var(--dots)}.acc{fill:var(--accent)}.run{fill:var(--run)}.need{fill:var(--need)}
.done{fill:var(--done)}.add{fill:var(--add)}.del{fill:var(--del)}.addtx{fill:var(--addtx)}.deltx{fill:var(--deltx)}
.stx{stroke:var(--text)}.smu{stroke:var(--muted)}.sfa{stroke:var(--faint)}.srun{stroke:var(--run)}.sacc{stroke:var(--accent)}
.shadow{flood-color:var(--shadow);flood-opacity:var(--shadowop)}
</style>"""

DEFS = """<defs>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" class="dot"/></pattern>
<filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="10" class="shadow"/></filter>
</defs>"""


def T(x, y, s, size=12, cls='tx', weight=None, anchor=None, extra=''):
    w = f' font-weight="{weight}"' if weight else ''
    a = f' text-anchor="{anchor}"' if anchor else ''
    return f'<text x="{x}" y="{y}" font-size="{size}" class="{cls}"{w}{a}{extra}>{escape(s)}</text>'


def tw(s, size=12, k=0.56):
    return len(s) * size * k


def svg(w, h, label, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{escape(label)}">\n<title>{escape(label)}</title>\n{STYLE}\n{DEFS}\n{body}\n</svg>\n')


def window(w, h, title, right=''):
    """Janela do app: moldura, barra de título com os semáforos e o canvas pontilhado."""
    return f'''<clipPath id="win"><rect x="1" y="1" width="{w-2}" height="{h-2}" rx="14"/></clipPath>
<g clip-path="url(#win)">
<rect width="{w}" height="{h}" class="bg"/>
<rect y="38" width="{w}" height="{h-38}" fill="url(#dots)"/>
<rect width="{w}" height="38" class="bg"/>
<path d="M0 38.5 H{w}" class="sl"/>
</g>
<rect x="1" y="1" width="{w-2}" height="{h-2}" rx="14" fill="none" class="sl2"/>
<circle cx="20" cy="19" r="6" fill="#ff5f57"/><circle cx="40" cy="19" r="6" fill="#febc2e"/><circle cx="60" cy="19" r="6" fill="#28c840"/>
{T(w/2, 24, title, 13, 'tx', 600, 'middle')}
{right}'''


def folder_icon(x, y, color):
    return (f'<rect x="{x}" y="{y}" width="22" height="22" rx="6" fill="{color}" fill-opacity=".16"/>'
            f'<path d="M{x+5} {y+7.5} h4 l1.6 1.8 h6.4 v7.2 h-12 z" fill="none" stroke="{color}" stroke-width="1.4" stroke-linejoin="round"/>')


def status_dot(cx, cy, st):
    if st == 'run':
        return (f'<circle cx="{cx}" cy="{cy}" r="7" class="run" fill-opacity=".18"/>'
                f'<circle cx="{cx}" cy="{cy}" r="3.6" class="run"/>')
    return f'<circle cx="{cx}" cy="{cy}" r="4" class="{st}"/>'


def card(x, y, w, name, color, rows, branch=None, dirty=None, selected=None):
    """Bloco de pasta. rows: (estado, título, rótulo à direita, [subagentes])."""
    h = 44 + sum(28 + 22 * len(r[3] if len(r) > 3 else []) for r in rows) + 8
    out = [f'<g transform="translate({x} {y})">',
           f'<rect width="{w}" height="{h}" rx="14" class="sf" filter="url(#sh)"/>',
           folder_icon(12, 12, color), T(42, 28, name, 13, 'tx', 600)]
    if branch:
        bx = w - 12 - tw(branch, 10.5, .62) - (26 if dirty else 0) - 18
        out.append(f'<path d="M{bx+4} {y*0+17} v10 M{bx+4} 24 c0-4 6-3 6-7" fill="none" class="sfa" stroke-width="1.3"/>'
                   f'<circle cx="{bx+10}" cy="16" r="1.8" fill="none" class="sfa" stroke-width="1.3"/>')
        out.append(T(bx + 16, 27, branch, 10.5, 'mu mono'))
        if dirty:
            px = w - 12 - 22
            out.append(f'<rect x="{px}" y="16" width="22" height="16" rx="8" class="need" fill-opacity=".18"/>'
                       + T(px + 11, 28, dirty, 10, 'need', 600, 'middle'))
    ry = 44
    for i, r in enumerate(rows):
        st, title, right = r[0], r[1], r[2]
        subs = r[3] if len(r) > 3 else []
        if selected == i:
            out.append(f'<rect x="6" y="{ry}" width="{w-12}" height="28" rx="8" class="acc" fill-opacity=".14"/>')
        out.append(status_dot(20, ry + 14, st))
        out.append(T(32, ry + 18, title, 12, 'tx'))
        if right:
            cls = {'need': 'need', 'run': 'run'}.get(st, 'fa')
            out.append(T(w - 14, ry + 18, right, 10.5, cls, 600 if st == 'need' else None, 'end'))
        ry += 28
        for j, s in enumerate(subs):
            out.append(f'<path d="M20 {ry-6} v{10 if j else 10} q0 4 4 4 h6" fill="none" class="sl2" stroke-width="1.2"/>')
            out.append(f'<circle cx="35" cy="{ry+8}" r="2.6" class="run" fill-opacity=".7"/>')
            out.append(T(43, ry + 12, s, 11, 'mu'))
            ry += 22
    out.append('</g>')
    return '\n'.join(out), h


def group(x, y, w, h, name, color):
    pw = tw(name, 12, .6) + 22
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{color}" fill-opacity=".07" '
            f'stroke="{color}" stroke-opacity=".5"/>'
            f'<rect x="{x+16}" y="{y-12}" width="{pw}" height="24" rx="12" fill="{color}"/>'
            f'<text x="{x+16+pw/2}" y="{y+4.5}" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">{escape(name)}</text>')


def terminal(x, y, w, h, title, lines):
    out = [f'<g transform="translate({x} {y})">',
           f'<rect width="{w}" height="{h}" rx="12" fill="#141416" stroke="#3a3a3f" filter="url(#sh)"/>',
           f'<path d="M0 30.5 H{w}" stroke="#2c2c31"/>',
           f'<text x="14" y="20" font-size="11" fill="#a8a8b2">{escape(title)}</text>']
    for i, (txt, col) in enumerate(lines):
        out.append(f'<text x="14" y="{52 + i*18}" font-size="11" class="mono" fill="{col}">{escape(txt)}</text>')
    cy = 52 + len(lines) * 18 - 11
    out.append(f'<rect x="14" y="{cy}" width="7" height="13" fill="#34d399"/>')
    out.append('</g>')
    return '\n'.join(out)


def mic(x, y, cls='smu'):
    return (f'<g fill="none" class="{cls}" stroke-width="1.5" stroke-linecap="round">'
            f'<rect x="{x-3.5}" y="{y-8}" width="7" height="11" rx="3.5"/>'
            f'<path d="M{x-6.5} {y} a6.5 6.5 0 0 0 13 0 M{x} {y+6.5} v3"/></g>')


def send_btn(x, y):
    return (f'<rect x="{x}" y="{y}" width="30" height="30" rx="8" class="acc"/>'
            f'<path d="M{x+15} {y+21} v-12 M{x+10} {y+14} l5 -5 l5 5" fill="none" stroke="#fff" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def ring(cx, cy, pct, r=9):
    import math
    c = 2 * math.pi * r
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" class="sl2" stroke-width="3"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{RED}" stroke-opacity="{.35 + pct*.6:.2f}" stroke-width="3" '
            f'stroke-dasharray="{c*pct:.1f} {c:.1f}" transform="rotate(-90 {cx} {cy})" stroke-linecap="round"/>')


def chip(x, y, s, cls='s2', tcls='mu', size=11, h=22):
    w = tw(s, size, .58) + 18
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="7" class="{cls}"/>' + T(x + w / 2, y + h / 2 + size * .36, s, size, tcls, None, 'middle'), w


def composer(x, y, w, placeholder, tags=()):
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="78" rx="14" class="sf2"/>']
    tx = x + 14
    for t, cls, tcls in tags:
        c, cw = chip(tx, y + 10, t, cls, tcls)
        out.append(c)
        tx += cw + 6
    out.append(T(tx + (4 if tags else 0), y + 25, placeholder, 12.5, 'fa'))
    cx = x + 14
    for t in ('Opus', 'Esforço alto'):
        c, cw = chip(cx, y + 46, t)
        out.append(c)
        cx += cw + 6
    out.append(ring(cx + 14, y + 57, .38, 7))
    out.append(mic(x + w - 62, y + 58))
    out.append(send_btn(x + w - 42, y + 42))
    return '\n'.join(out)


# ---------------------------------------------------------------- Visão geral
def hero():
    W, H = 1200, 690
    b = [window(W, H, 'Argus',
                T(W - 18, 24, '0.1.21', 11, 'fa', None, 'end')
                + f'<rect x="{W-170}" y="15" width="70" height="6" rx="3" class="s2"/>'
                + f'<rect x="{W-170}" y="15" width="44" height="6" rx="3" class="done"/>'
                + T(W - 178, 22, 'Uso 62%', 10.5, 'mu', None, 'end'))]

    # Trabalho
    b.append(group(34, 92, 528, 316, 'Trabalho', TRAB))
    c, _ = card(52, 114, 246, 'site', TRAB,
                [('run', 'Refatorar checkout', '', ['revisor - lendo cart.ts', 'testador - pnpm test']),
                 ('done', 'Ajustar header', '2 min'), ('done', 'Nova landing', '1 h')],
                branch='main', dirty='3', selected=0)
    b.append(c)
    c, _ = card(312, 114, 232, 'api', TRAB,
                [('need', 'Migrar o banco', 'esperando você'), ('done', 'Rate limit', 'ontem')], branch='dev')
    b.append(c)
    c, _ = card(312, 254, 232, 'design-system', TRAB,
                [('run', 'Tokens de cor', ''), ('done', 'Botão secundário', '3 h')], branch='main')
    b.append(c)
    c, _ = card(52, 314, 246, 'app-mobile', TRAB, [('done', 'Push de pedidos', '5 h')], branch='main')
    b.append(c)

    # Pessoal
    b.append(group(34, 452, 374, 142, 'Pessoal', PESS))
    c, _ = card(52, 476, 164, 'blog', PESS, [('done', 'Post novo', '')])
    b.append(c)
    c, _ = card(228, 476, 164, 'receitas', PESS, [('run', 'Busca', '')])
    b.append(c)

    # Nota
    nx, ny = 432, 470
    b.append(f'<path d="M{nx+16} {ny} h176 a16 16 0 0 1 16 16 v28 a16 16 0 0 1 -16 16 h-188 a4 4 0 0 1 -4 -4 v-40 a16 16 0 0 1 16 -16 z" '
             f'class="sf" filter="url(#sh)"/>'
             f'<path d="M{nx+16} {ny} h176 a16 16 0 0 1 16 16 v28 a16 16 0 0 1 -16 16 h-188 a4 4 0 0 1 -4 -4 v-40 a16 16 0 0 1 16 -16 z" '
             f'fill="{FREELA}" fill-opacity=".16" stroke="{FREELA}" stroke-opacity=".45"/>'
             + T(nx + 14, ny + 23, 'Revisar o checkout antes', 12.5)
             + T(nx + 14, ny + 41, 'da reunião de sexta', 12.5))

    # Terminal
    b.append(terminal(580, 92, 214, 150, 'Terminal - site',
                      [('~/site ❯ pnpm dev', '#f0f0f2'), ('ready  localhost:3000', '#34d399'), ('~/site ❯', '#a8a8b2')]))


    # Minimapa
    mx, my = 620, 556
    b.append(f'<rect x="{mx}" y="{my}" width="174" height="96" rx="12" class="sf" filter="url(#sh)"/>')
    for rx, ry, rw, rh, col in [(12, 14, 34, 26, TRAB), (50, 14, 30, 16, TRAB), (50, 34, 30, 16, TRAB), (12, 44, 34, 10, TRAB),
                                (12, 64, 22, 14, PESS), (38, 64, 22, 14, PESS), (88, 14, 18, 14, '#6b7280')]:
        b.append(f'<rect x="{mx+rx}" y="{my+ry}" width="{rw}" height="{rh}" rx="3" fill="{col}" fill-opacity=".55"/>')
    b.append(f'<rect x="{mx+8}" y="{my+9}" width="80" height="54" rx="4" fill="none" class="sacc" stroke-width="1.4"/>')
    b.append(T(mx + 118, my + 30, 'Pessoal', 10, 'mu') + T(mx + 118, my + 48, 'Trabalho', 10, 'mu'))

    # Barra de comando
    bx, by = 156, 628
    b.append(f'<rect x="{bx}" y="{by}" width="420" height="40" rx="12" class="sf2" filter="url(#sh)"/>'
             f'<path d="M{bx+20} {by+11} l2.4 6.6 l6.6 2.4 l-6.6 2.4 l-2.4 6.6 l-2.4 -6.6 l-6.6 -2.4 l6.6 -2.4 z" class="acc"/>'
             + T(bx + 38, by + 25, 'Cria um grupo Freela com essas duas pastas', 12.5, 'mu')
             + mic(bx + 398, by + 20))

    # Painel da conversa
    dx, dy, dw, dh = 818, 52, 368, 624
    b.append(f'<rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" rx="16" class="sf" filter="url(#sh)"/>')
    b.append(T(dx + 18, dy + 30, 'Refatorar checkout', 14, 'tx', 600) + T(dx + 18, dy + 48, 'site - main', 11, 'mu'))
    b.append(ring(dx + dw - 52, dy + 32, .42))
    b.append(f'<g class="mu"><circle cx="{dx+dw-24}" cy="{dy+32}" r="1.6"/><circle cx="{dx+dw-18}" cy="{dy+32}" r="1.6"/>'
             f'<circle cx="{dx+dw-30}" cy="{dy+32}" r="1.6"/></g>')
    b.append(f'<path d="M{dx} {dy+64.5} H{dx+dw}" class="sl"/>')

    ux = dx + 104
    b.append(f'<rect x="{ux}" y="{dy+82}" width="{dw-122}" height="52" rx="14" class="s2"/>'
             + T(ux + 14, dy + 104, 'Separa o cálculo do frete num', 12.5)
             + T(ux + 14, dy + 122, 'módulo e cobre com testes.', 12.5))
    b.append(T(dx + 18, dy + 162, 'Movi o cálculo para frete.ts e troquei a', 12.5)
             + T(dx + 18, dy + 180, 'chamada no carrinho:', 12.5))
    # ferramenta + diff
    b.append(f'<path d="M{dx+22} {dy+198} l-4 4 l4 4 M{dx+30} {dy+198} l4 4 l-4 4" fill="none" class="smu" stroke-width="1.4"/>'
             + T(dx + 42, dy + 206, 'Editou src/cart/frete.ts', 11.5, 'mu mono')
             + T(dx + dw - 18, dy + 206, '+12 -3', 11, 'done mono', None, 'end'))
    gx, gy = dx + 18, dy + 216
    b.append(f'<rect x="{gx}" y="{gy}" width="{dw-36}" height="78" rx="10" class="bg" stroke="var(--line)"/>'
             f'<rect x="{gx+1}" y="{gy+8}" width="{dw-38}" height="20" class="del"/>'
             f'<rect x="{gx+1}" y="{gy+29}" width="{dw-38}" height="40" class="add"/>'
             + T(gx + 10, gy + 22, '- const frete = peso * 1.2', 11, 'deltx mono')
             + T(gx + 10, gy + 43, "+ import { calcularFrete } from './frete'", 11, 'addtx mono')
             + T(gx + 10, gy + 63, '+ const frete = calcularFrete(pedido)', 11, 'addtx mono'))
    # permissão
    px, py = dx + 18, dy + 318
    b.append(f'<rect x="{px}" y="{py}" width="{dw-36}" height="118" rx="12" class="sf"/>'
             f'<rect x="{px}" y="{py}" width="{dw-36}" height="118" rx="12" fill="{TRAB}" fill-opacity=".08" stroke="{TRAB}" stroke-opacity=".7"/>'
             + T(px + 14, py + 24, 'Permitir este comando?', 12.5, 'tx', 600)
             + f'<rect x="{px+14}" y="{py+36}" width="{dw-64}" height="28" rx="7" class="bg"/>'
             + T(px + 24, py + 54, '$ pnpm test src/cart', 11.5, 'tx mono'))
    b.append(f'<rect x="{px+dw-36-184}" y="{py+76}" width="80" height="30" rx="8" class="s2"/>'
             + T(px + dw - 36 - 144, py + 95, 'Negar', 12, 'tx', 500, 'middle')
             + f'<rect x="{px+dw-36-96}" y="{py+76}" width="82" height="30" rx="8" fill="{TRAB}"/>'
             + f'<text x="{px+dw-36-55}" y="{py+95}" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">Permitir</text>')
    b.append(f'<circle cx="{dx+24}" cy="{dy+462}" r="3.5" class="need"/>' + T(dx + 34, dy + 466, 'Esperando você - 1:12', 11, 'mu'))
    b.append(composer(dx + 12, dy + dh - 92, dw - 24, 'Responder…'))
    return svg(W, H, 'Canvas do Argus com projetos agrupados, conversas rodando e o painel da conversa pedindo permissão', '\n'.join(b))


# ---------------------------------------------------------------- Modo design
def design():
    W, H = 1200, 600
    b = [window(W, H, 'Argus')]
    ox, oy, ow, oh = 10, 46, W - 20, H - 56
    b.append(f'<rect x="{ox}" y="{oy}" width="{ow}" height="{oh}" rx="16" class="sf" filter="url(#sh)"/>')
    # barra de cima
    b.append(f'<path d="M{ox+18} {oy+16} l9 9 l-6 6 l-9 -9 z M{ox+17} {oy+29} l-3 6 l6 -3" fill="none" class="smu" stroke-width="1.4" stroke-linejoin="round"/>'
             + T(ox + 42, oy + 30, 'Checkout mais direto', 13, 'tx', 600) + T(ox + 186, oy + 30, 'loja', 12, 'mu'))
    sx = W / 2 - 90
    b.append(f'<rect x="{sx}" y="{oy+10}" width="180" height="30" rx="10" class="s2"/>'
             f'<rect x="{sx+3}" y="{oy+13}" width="86" height="24" rx="8" class="sf"/>'
             + T(sx + 46, oy + 30, 'Desktop', 12, 'tx', 500, 'middle') + T(sx + 134, oy + 30, 'Celular', 12, 'mu', None, 'middle'))
    b.append(T(ox + ow - 52, oy + 30, 'Visualizar', 12, 'tx', None, 'end')
             + f'<path d="M{ox+ow-32} {oy+20} l10 10 M{ox+ow-22} {oy+20} l-10 10" class="smu" stroke-width="1.5"/>')
    b.append(f'<path d="M{ox} {oy+50.5} H{ox+ow}" class="sl"/>')

    # endereço + Comentar
    ax, ay = ox + 16, oy + 64
    b.append(f'<rect x="{ax}" y="{ay}" width="560" height="32" rx="9" class="s2"/>'
             + T(ax + 14, ay + 21, 'localhost:3000', 12, 'mu mono') + T(ax + 118, ay + 21, '/checkout', 12, 'tx mono')
             + f'<path d="M{ax+540} {ay+13} l5 5 l5 -5" fill="none" class="smu" stroke-width="1.5"/>')
    c, _ = chip(ax + 572, ay + 2, 'site  :3000', 's2', 'mu', 11.5, 28)
    b.append(c)
    b.append(f'<rect x="{ax+672}" y="{ay}" width="108" height="32" rx="9" class="acc"/>'
             f'<path d="M{ax+688} {ay+10} h14 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-8 l-4 4 v-4 h-2 a3 3 0 0 1 -3 -3 v-6 a3 3 0 0 1 3 -3 z" fill="none" stroke="#fff" stroke-width="1.4"/>'
             f'<text x="{ax+714}" y="{ay+21}" font-size="12" font-weight="600" fill="#fff">Comentar</text>')

    # página do projeto (sempre clara, é o site da pessoa)
    gx, gy, gw, gh = ox + 16, oy + 108, 780, oh - 124
    b.append(f'<g><clipPath id="pg"><rect x="{gx}" y="{gy}" width="{gw}" height="{gh}" rx="10"/></clipPath>'
             f'<g clip-path="url(#pg)"><rect x="{gx}" y="{gy}" width="{gw}" height="{gh}" fill="#f7f7f8"/>'
             f'<rect x="{gx}" y="{gy}" width="{gw}" height="52" fill="#ffffff"/><path d="M{gx} {gy+52.5} H{gx+gw}" stroke="#e5e5ea"/>'
             f'<rect x="{gx+24}" y="{gy+16}" width="20" height="20" rx="6" fill="#7c3aed"/>'
             f'<text x="{gx+52}" y="{gy+31}" font-size="14" font-weight="700" fill="#1d1d1f">Loja</text>'
             f'<text x="{gx+gw-24}" y="{gy+31}" font-size="12" fill="#6e6e73" text-anchor="end">Produtos    Pedidos    Conta</text>'
             f'<text x="{gx+32}" y="{gy+96}" font-size="22" font-weight="700" fill="#1d1d1f">Finalizar compra</text>')
    fx, fy = gx + 32, gy + 116
    b.append(f'<rect x="{fx}" y="{fy}" width="420" height="250" rx="12" fill="#fff" stroke="#e5e5ea"/>')
    for i, lab in enumerate(['Nome completo', 'E-mail', 'CPF']):
        yy = fy + 22 + i * 72
        b.append(f'<text x="{fx+20}" y="{yy+12}" font-size="11.5" fill="#6e6e73">{lab}</text>'
                 f'<rect x="{fx+20}" y="{yy+20}" width="380" height="34" rx="8" fill="#fff" stroke="#d1d1d6"/>')
    sx2, sy2 = fx + 444, fy
    b.append(f'<rect x="{sx2}" y="{sy2}" width="272" height="196" rx="12" fill="#fff" stroke="#e5e5ea"/>'
             f'<text x="{sx2+20}" y="{sy2+32}" font-size="13" font-weight="600" fill="#1d1d1f">Resumo</text>'
             f'<text x="{sx2+20}" y="{sy2+62}" font-size="12" fill="#6e6e73">2 itens</text>'
             f'<text x="{sx2+252}" y="{sy2+62}" font-size="12" fill="#1d1d1f" text-anchor="end">R$ 169,90</text>'
             f'<text x="{sx2+20}" y="{sy2+86}" font-size="12" fill="#6e6e73">Frete</text>'
             f'<text x="{sx2+252}" y="{sy2+86}" font-size="12" fill="#1d1d1f" text-anchor="end">R$ 20,00</text>'
             f'<path d="M{sx2+20} {sy2+102.5} H{sx2+252}" stroke="#e5e5ea"/>'
             f'<text x="{sx2+20}" y="{sy2+126}" font-size="13" font-weight="700" fill="#1d1d1f">Total</text>'
             f'<text x="{sx2+252}" y="{sy2+126}" font-size="13" font-weight="700" fill="#1d1d1f" text-anchor="end">R$ 189,90</text>'
             f'<rect x="{sx2+20}" y="{sy2+144}" width="120" height="34" rx="8" fill="#d1d1d6"/>'
             f'<text x="{sx2+80}" y="{sy2+165}" font-size="12" font-weight="600" fill="#3a3a3c" text-anchor="middle">Pagar</text>'
             '</g></g>')

    def pin(x, y, n, lines, side=1):
        out = [f'<circle cx="{x}" cy="{y}" r="12" class="acc" stroke="#fff" stroke-width="2"/>'
               f'<text x="{x}" y="{y+4}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">{n}</text>']
        bw = max(tw(l, 12, .55) for l in lines) + 28
        bh = 16 + 18 * len(lines)
        bx = x + 18 if side > 0 else x - 18 - bw
        by = y - 8
        out.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" class="sf" filter="url(#sh)"/>'
                   f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="14" class="acc" fill-opacity=".10" stroke="var(--accent)" stroke-opacity=".5"/>')
        for i, l in enumerate(lines):
            out.append(T(bx + 14, by + 22 + i * 18, l, 12))
        return '\n'.join(out)

    b.append(pin(sx2 + 140, sy2 + 160, 1, ['Botão maior e na', 'cor da marca']))
    b.append(pin(fx + 400, fy + 182, 2, ['Tirar este campo'], -1 if False else 1))

    # coluna do chat
    cx, cy, cw = gx + gw + 16, oy + 64, ox + ow - (gx + gw + 16) - 16
    b.append(f'<path d="M{cx-8.5} {oy+51} V{oy+oh}" class="sl"/>')
    b.append(f'<rect x="{cx+60}" y="{cy}" width="{cw-60}" height="52" rx="14" class="s2"/>'
             + T(cx + 74, cy + 22, 'Deixa o checkout mais direto,', 12.5) + T(cx + 74, cy + 40, 'num passo só.', 12.5))
    b.append(T(cx, cy + 82, 'Juntei endereço e pagamento na mesma', 12.5) + T(cx, cy + 100, 'tela e tirei o passo de revisão.', 12.5))
    for i, f in enumerate(['app/checkout/page.tsx', 'components/Resumo.tsx']):
        yy = cy + 126 + i * 24
        b.append(f'<path d="M{cx+4} {yy-8} l-4 4 l4 4 M{cx+12} {yy-8} l4 4 l-4 4" fill="none" class="smu" stroke-width="1.4"/>'
                 + T(cx + 24, yy, 'Editou ' + f, 11, 'mu mono'))
    b.append(f'<circle cx="{cx+5}" cy="{cy+186}" r="3.5" class="done"/>' + T(cx + 16, cy + 190, 'Concluída - 2:08', 11, 'mu'))
    b.append(composer(cx - 4, oy + oh - 92, cw + 8, 'Descreva o ajuste…',
                      tags=[('2 comentários', 'acc', 'tx')]).replace('class="acc"/>', 'class="acc" fill-opacity=".18"/>', 1))
    return svg(W, H, 'Modo design: a página do projeto aberta no Argus, com comentários presos aos elementos e o chat ao lado', '\n'.join(b))


# ---------------------------------------------------------------- Acompanhamento
def app_icon(x, y, s=28):
    k = s / 824
    return (f'<g transform="translate({x} {y}) scale({k})"><rect width="824" height="824" rx="186" fill="#1f1f23"/>'
            f'<rect x="96" y="114" width="604" height="220" rx="48" fill="#3a3a41"/>'
            f'<rect x="136" y="164" width="120" height="120" rx="30" fill="#f2f2f4"/>'
            f'<rect x="292" y="182" width="320" height="38" rx="19" fill="#ececef"/>'
            f'<rect x="260" y="412" width="468" height="120" rx="36" fill="#2a2a2f"/>'
            f'<circle cx="320" cy="472" r="17" fill="#60a5fa"/></g>')


def acompanhamento():
    W, H = 1200, 400
    b = []
    # 1. barra de menus
    x0 = 0
    b.append(f'<rect x="{x0+1}" y="1" width="388" height="398" rx="16" class="bg" stroke="var(--line2)"/>'
             f'<rect x="{x0+1}" y="1" width="388" height="32" rx="16" class="s2"/><rect x="{x0+1}" y="20" width="388" height="13" class="s2"/>'
             + T(x0 + 292, 22, '14:32', 12, 'tx', 500))
    b.append(f'<rect x="{x0+238}" y="7" width="22" height="20" rx="5" class="acc" fill-opacity=".25"/>'
             + app_icon(x0 + 241, 9, 16)
             + f'<circle cx="{x0+257}" cy="10" r="4" class="need"/>')
    mx, my = x0 + 26, 44
    b.append(f'<rect x="{mx}" y="{my}" width="336" height="330" rx="14" class="sf" filter="url(#sh)"/>')
    rows = [('Rodando', None), ('site - Refatorar checkout', 'run'), ('design-system - Tokens de cor', 'run'),
            ('Esperando você', None), ('api - Migrar o banco', 'need'), ('Concluídas hoje', None),
            ('site - Ajustar header', 'done'), ('app-mobile - Push de pedidos', 'done')]
    yy = my + 30
    for t, st in rows:
        if st is None:
            b.append(T(mx + 18, yy, t, 11, 'fa', 600))
            yy += 26
        else:
            b.append(status_dot(mx + 24, yy - 4, st) + T(mx + 38, yy, t, 12.5))
            yy += 30
    b.append(f'<path d="M{mx+12} {my+284.5} H{mx+324}" class="sl"/>' + T(mx + 18, my + 312, 'Abrir o Argus', 12.5, 'tx', 500))

    # 2. notificações
    x1 = 406
    b.append(f'<rect x="{x1+1}" y="1" width="388" height="398" rx="16" fill="url(#dots)" stroke="var(--line2)"/>')

    def notif(y, title, body, sub, when):
        return (f'<rect x="{x1+22}" y="{y}" width="346" height="88" rx="18" class="sf" filter="url(#sh)"/>'
                + app_icon(x1 + 38, y + 18, 34)
                + T(x1 + 86, y + 28, title, 12.5, 'tx', 600) + T(x1 + 352, y + 28, when, 11, 'fa', None, 'end')
                + T(x1 + 86, y + 47, body, 12, 'tx') + T(x1 + 86, y + 65, sub, 12, 'mu'))

    b.append(notif(40, 'api', 'Migrar o banco', 'O Claude quer rodar um comando', 'agora'))
    b.append(notif(146, 'site', 'Refatorar checkout', 'Concluída em 4 min', '2 min'))
    b.append(notif(252, 'design-system', 'Tokens de cor', 'O Claude tem uma pergunta', '6 min'))

    # 3. uso e servidores
    x2 = 812
    b.append(f'<rect x="{x2+1}" y="1" width="386" height="398" rx="16" class="bg" stroke="var(--line2)"/>')
    b.append(f'<rect x="{x2+20}" y="22" width="348" height="150" rx="14" class="sf"/>' + T(x2 + 38, 50, 'Limite de uso', 13, 'tx', 600))
    for i, (nome, pct, col) in enumerate([('Pessoal', .38, 'done'), ('Trabalho', .72, 'need')]):
        yy = 84 + i * 44
        b.append(T(x2 + 38, yy, nome, 12, 'tx') + T(x2 + 350, yy, f'{int(pct*100)}%', 12, 'mu', None, 'end')
                 + f'<rect x="{x2+38}" y="{yy+10}" width="312" height="7" rx="3.5" class="s2"/>'
                 + f'<rect x="{x2+38}" y="{yy+10}" width="{312*pct:.0f}" height="7" rx="3.5" class="{col}"/>')
    b.append(f'<rect x="{x2+20}" y="188" width="348" height="190" rx="14" class="sf"/>' + T(x2 + 38, 216, 'Servidores rodando', 13, 'tx', 600))
    for i, (app, port) in enumerate([('site', ':3000'), ('admin', ':3001'), ('api', ':8080')]):
        yy = 252 + i * 42
        b.append(f'<circle cx="{x2+44}" cy="{yy-4}" r="4" class="done"/>' + T(x2 + 58, yy, app, 12.5, 'tx', 500)
                 + T(x2 + 106, yy, port, 12, 'mu mono')
                 + f'<rect x="{x2+226}" y="{yy-18}" width="58" height="26" rx="7" class="s2"/>' + T(x2 + 255, yy - 1, 'Abrir', 11.5, 'tx', None, 'middle')
                 + f'<rect x="{x2+290}" y="{yy-18}" width="62" height="26" rx="7" class="s2"/>' + T(x2 + 321, yy - 1, 'Encerrar', 11.5, 'tx', None, 'middle'))
    return svg(W, H, 'Ícone na barra de menus com o resumo das conversas, notificações do sistema, limite de uso por conta e servidores rodando', '\n'.join(b))


# ---------------------------------------------------------------- Ferramentas
def ferramentas():
    W, H = 1200, 460
    b = []
    # explorador + editor
    ex, ey, ew, eh = 1, 1, 760, 458
    b.append(f'<rect x="{ex}" y="{ey}" width="{ew}" height="{eh}" rx="16" class="sf" stroke="var(--line2)"/>'
             f'<path d="M{ex+220.5} {ey} V{ey+eh}" class="sl"/>')
    tree = [(0, 'site', 'tx', 'd'), (1, 'src', 'tx', 'd'), (2, 'cart', 'tx', 'd'), (3, 'cart.ts', 'need', 'f'),
            (3, 'frete.ts', 'done', 'f'), (3, 'frete.test.ts', 'done', 'f'), (2, 'components', 'tx', 'd'),
            (2, 'app.tsx', 'tx', 'f'), (1, 'package.json', 'tx', 'f'), (1, 'README.md', 'tx', 'f')]
    for i, (lvl, name, cls, kind) in enumerate(tree):
        yy = ey + 34 + i * 28
        xx = ex + 18 + lvl * 16
        if name == 'frete.ts':
            b.append(f'<rect x="{ex+8}" y="{yy-18}" width="204" height="26" rx="7" class="acc" fill-opacity=".14"/>')
        if kind == 'd':
            b.append(f'<path d="M{xx} {yy-8} l4 4 l4 -4" fill="none" class="smu" stroke-width="1.4"/>')
        b.append(T(xx + 14, yy, name, 12.5, cls))
        if cls == 'need':
            b.append(T(ex + 204, yy, 'M', 11, 'need', 600, 'end'))
        elif cls == 'done':
            b.append(T(ex + 204, yy, 'U', 11, 'done', 600, 'end'))
    cx = ex + 221
    b.append(f'<rect x="{cx+12}" y="{ey+12}" width="112" height="30" rx="8" class="s2"/>' + T(cx + 26, ey + 32, 'frete.ts', 12, 'tx', 500)
             + f'<circle cx="{cx+108}" cy="{ey+27}" r="3.5" class="mu"/>'
             + f'<rect x="{ew-128}" y="{ey+12}" width="112" height="30" rx="8" class="s2"/>'
             + T(ew - 72, ey + 32, '⌘S salva', 12, 'mu', None, 'middle'))
    K, S, F, N, C = '#c678dd', '#16a34a', '#2563eb', '#d97706', 'var(--faint)'
    code = [
        [("// Frete por peso, com mínimo por região", C)],
        [("import", K), (" { REGIOES } ", None), ("from", K), (" './regioes'", S)],
        [],
        [("export function", K), (" calcularFrete", F), ("(pedido: Pedido) {", None)],
        [("  const", K), (" regiao = REGIOES[pedido.uf]", None)],
        [("  const", K), (" porPeso = pedido.peso * regiao.taxa", None)],
        [("  return", K), (" Math.max(porPeso, regiao.minimo)", None)],
        [("}", None)],
        [],
        [("export const", K), (" FRETE_GRATIS_A_PARTIR", F), (" = ", None), ("299", N)],
    ]
    for i, parts in enumerate(code):
        yy = ey + 80 + i * 24
        b.append(T(cx + 34, yy, str(i + 1), 12, 'fa mono', None, 'end'))
        xx = cx + 50
        for txt, col in parts:
            fill = f' style="fill:{col}"' if col else ''
            cls = 'mono' if col else 'tx mono'
            b.append(f'<text x="{xx:.1f}" y="{yy}" font-size="12.5" class="{cls}" xml:space="preserve"{fill}>{escape(txt)}</text>')
            xx += len(txt) * 7.53

    # terminal
    b.append(terminal(780, 1, 418, 200, 'Terminal - site',
                      [('~/site ❯ pnpm test src/cart', '#f0f0f2'), ('✓ frete.test.ts (6)', '#34d399'), ('✓ cart.test.ts (14)', '#34d399'),
                       ('Tests  20 passed', '#f0f0f2'), ('~/site ❯', '#a8a8b2')]).replace('filter="url(#sh)"', ''))

    # agentes
    ax, ay = 780, 218
    b.append(f'<rect x="{ax+1}" y="{ay}" width="417" height="240" rx="16" class="sf" stroke="var(--line2)"/>'
             + T(ax + 20, ay + 32, 'Agentes', 13, 'tx', 600)
             + f'<rect x="{ax+296}" y="{ay+14}" width="104" height="28" rx="8" class="acc"/>'
             + f'<text x="{ax+348}" y="{ay+32}" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">Novo agente</text>')
    for i, (nome, desc, col) in enumerate([('revisor', 'Revisa o diff antes do commit', TRAB),
                                           ('testador', 'Roda os testes e corrige o que quebrar', PESS),
                                           ('redator', 'Escreve textos de interface e release', FREELA)]):
        yy = ay + 58 + i * 58
        b.append(f'<rect x="{ax+16}" y="{yy}" width="386" height="48" rx="10" class="s2" fill-opacity=".6"/>'
                 f'<rect x="{ax+28}" y="{yy+11}" width="26" height="26" rx="7" fill="{col}" fill-opacity=".18"/>'
                 f'<rect x="{ax+34}" y="{yy+18}" width="14" height="11" rx="3" fill="none" stroke="{col}" stroke-width="1.5"/>'
                 f'<circle cx="{ax+38.5}" cy="{yy+23.5}" r="1.2" fill="{col}"/><circle cx="{ax+43.5}" cy="{yy+23.5}" r="1.2" fill="{col}"/>'
                 + T(ax + 66, yy + 21, '@' + nome, 12.5, 'tx', 600) + T(ax + 66, yy + 38, desc, 11.5, 'mu'))
    return svg(W, H, 'Explorador de arquivos com as mudanças do git, editor de código, terminal embutido e a biblioteca de agentes', '\n'.join(b))


for name, fn in [('canvas', hero), ('modo-design', design), ('acompanhamento', acompanhamento), ('ferramentas', ferramentas)]:
    with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
        f.write(fn())
print('ok')
