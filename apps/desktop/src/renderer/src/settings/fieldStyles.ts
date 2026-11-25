// Campos de texto das Configurações (e da biblioteca de agentes), no desenho do Head Desk: 36 px,
// canto arredondado, fundo sutil e, com o foco, a borda e um brilho na cor de destaque. O Select
// (settings/Select.tsx) segue o mesmo desenho.

// Sem tamanho de letra: para quem tem o seu (a biblioteca de agentes). Em textarea, a altura cresce
// com as linhas.
export const FIELD_SHELL =
  'min-h-9 rounded-lg border border-line bg-fill px-3 py-1.5 text-text outline-none placeholder:text-faint transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-40';

// Padrão das Configurações (texto mínimo de 15 px).
export const FIELD = `${FIELD_SHELL} text-[15px]`;
