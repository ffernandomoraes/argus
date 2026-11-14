import { useEffect } from 'react';
import type { ThemeSource } from '@argus/shared/ipc';

// Cor da barra da janela do app instalado (no computador, a barra de título do Chrome e do Edge; no
// Android, a barra do sistema): na pasta e na conversa, a cor do grupo, no tom da pílula dele
// (GroupLabel); fora delas, o fundo do tema. Uma cor só, trocada por aqui: com uma por tema
// (media="prefers-color-scheme"), o Chrome caía no preto do manifesto até no tema claro.

const BG = { light: '#f2f2f7', dark: '#000000' };
let theme: ThemeSource = 'system';
let screen: string | null = null;

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function update(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  meta.content = screen ?? (theme === 'dark' || (theme === 'system' && systemDark()) ? BG.dark : BG.light);
}

if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
if (typeof document !== 'undefined') update();

export function setWindowTheme(next: ThemeSource): void {
  theme = next;
  update();
}

// A cor do grupo como a pílula: 65% dela e 35% de preto (o branco do título lê bem). O canvas
// normaliza qualquer cor do CSS para #rrggbb.
function groupShade(color: string): string | null {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  const hex = /^#([0-9a-f]{6})$/i.exec(ctx.fillStyle)?.[1];
  if (!hex) return null;
  const channel = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.65).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

// Tela de um grupo (pasta, conversa): a barra fica na cor dele enquanto ela está aberta.
export function useWindowColor(groupColor: string | undefined): void {
  useEffect(() => {
    screen = groupColor ? groupShade(groupColor) : null;
    update();
    return () => {
      screen = null;
      update();
    };
  }, [groupColor]);
}
