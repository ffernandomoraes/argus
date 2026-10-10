# Ferramentas: o explorador de arquivos com as mudanças do git, o editor, o terminal embutido e a
# biblioteca de agentes.
from xml.sax.saxutils import escape

from .base import FREELA, PESS, TRAB, T, svg
from .componentes import terminal


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
