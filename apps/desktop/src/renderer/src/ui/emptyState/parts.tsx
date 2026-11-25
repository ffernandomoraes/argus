import type { ReactNode } from 'react';

// Peças comuns das ilustrações das telas vazias: as cores (tokens do tema, então seguem o claro e o
// escuro) e os desenhos que se repetem (notebook, caminho tracejado, cartão de grade).

export const ACCENT = 'var(--color-accent)';
export const ACCENT_SOFT = 'color-mix(in srgb, var(--color-accent) 35%, transparent)';
export const LINE = 'var(--color-line-strong)';
export const SURFACE = 'var(--color-surface)';
export const SURFACE_2 = 'var(--color-surface-2)';
export const FILL = 'var(--color-fill)';

export function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 110" className="h-auto w-full" aria-hidden="true">
      {children}
    </svg>
  );
}

// Notebook com cards de canvas na tela; active pinta a borda e um card com o destaque.
export function Laptop({ x, active }: { x: number; active?: boolean }) {
  const stroke = active ? ACCENT : LINE;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="22" width="92" height="60" rx="6" fill={SURFACE} stroke={stroke} strokeWidth="1.5" />
      <rect x="7" y="29" width="78" height="46" rx="3" fill={FILL} />
      <rect x="14" y="36" width="24" height="15" rx="2.5" fill={active ? ACCENT_SOFT : LINE} />
      <rect x="44" y="36" width="34" height="15" rx="2.5" fill={LINE} opacity={active ? 1 : 0.6} />
      <rect x="14" y="56" width="34" height="13" rx="2.5" fill={LINE} opacity={active ? 1 : 0.6} />
      <rect x="54" y="56" width="24" height="13" rx="2.5" fill={LINE} opacity="0.6" />
      <path d="M-8 82 h108 l-6 7 h-96 z" fill={SURFACE_2} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  );
}

// Curva tracejada no destaque, com a ponta de seta no fim (d termina em x2,y2).
export function Trail({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 5" strokeLinecap="round" />;
}

export function Arrowhead({ d }: { d: string }) {
  return <path d={d} fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
}

// Cartão quadrado com borda no destaque (o "objeto" que viaja ou o centro da cena).
export function Badge({ x, y, size = 28, children }: { x: number; y: number; size?: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={size} height={size} rx={size / 4} fill={SURFACE} stroke={ACCENT} strokeWidth="1.5" />
      {children}
    </g>
  );
}

// Faixa de texto falso (barrinha arredondada).
export function Bar({ x, y, w, h = 5, fill = LINE, opacity }: { x: number; y: number; w: number; h?: number; fill?: string; opacity?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} opacity={opacity} />;
}
