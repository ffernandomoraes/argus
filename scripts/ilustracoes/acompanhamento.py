# Acompanhamento: o ícone na barra de menus, as notificações do sistema, o limite de uso por conta e
# os servidores rodando.
from .base import T, svg
from .componentes import status_dot


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
