# Modo design: a página do projeto aberta no Argus, com comentários presos aos elementos e o chat ao lado.
from .base import T, svg, tw
from .componentes import chip, composer, window


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
