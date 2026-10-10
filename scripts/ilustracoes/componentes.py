# Peças do app usadas nas ilustrações: janela, bloco de pasta, grupo, terminal e o campo da conversa.
import math
from xml.sax.saxutils import escape

from .base import RED, T, tw


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
