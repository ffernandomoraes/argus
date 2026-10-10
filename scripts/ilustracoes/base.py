# Estilo e texto comuns a todas as ilustrações. Cada SVG troca sozinho entre claro e escuro pelo
# prefers-color-scheme, como o GitHub mostra.
from xml.sax.saxutils import escape

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
