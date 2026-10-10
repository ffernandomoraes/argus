# Ilustrações do README (docs/ilustracoes/*.svg): esquemas do app, não prints. Cada SVG troca
# sozinho entre claro e escuro pelo prefers-color-scheme, como o GitHub mostra. O desenho de cada
# uma mora em scripts/ilustracoes/.
# Rodar: python3 scripts/gerar-ilustracoes.py [pasta de saída]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Sem __pycache__ dentro de scripts/; e a pasta dos módulos no caminho mesmo com python3 -I.
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)

from ilustracoes.acompanhamento import acompanhamento  # noqa: E402
from ilustracoes.canvas import hero  # noqa: E402
from ilustracoes.ferramentas import ferramentas  # noqa: E402
from ilustracoes.modo_design import design  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'docs', 'ilustracoes')
os.makedirs(OUT, exist_ok=True)

for name, fn in [('canvas', hero), ('modo-design', design), ('acompanhamento', acompanhamento), ('ferramentas', ferramentas)]:
    with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
        f.write(fn())
print('ok')
