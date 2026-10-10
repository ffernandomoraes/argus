# Visão geral: o canvas com projetos agrupados, conversas rodando e o painel da conversa.
from .base import FREELA, PESS, TRAB, T, svg
from .componentes import card, composer, group, mic, ring, terminal, window


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

    b.append(_conversa(818, 52, 368, 624))
    return svg(W, H, 'Canvas do Argus com projetos agrupados, conversas rodando e o painel da conversa pedindo permissão', '\n'.join(b))


# Painel da conversa: o pedido, a resposta com o diff e a pergunta de permissão.
def _conversa(dx, dy, dw, dh):
    b = [f'<rect x="{dx}" y="{dy}" width="{dw}" height="{dh}" rx="16" class="sf" filter="url(#sh)"/>']
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
    return '\n'.join(b)
