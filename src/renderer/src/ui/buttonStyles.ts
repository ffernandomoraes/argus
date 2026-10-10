// Classes dos botões do app, num lugar só. Regras: todo botão é `rounded-md` (nada de
// `rounded-full`); o principal é a cor de destaque com texto branco.
//
// Variantes (o fundo de onde o botão está decide entre ghost e subtle):
// - primary: a ação principal (Salvar, Próximo, Enviar).
// - secondary: neutro com borda (Cancelar, Voltar, os botões das configurações).
// - ghost: sem fundo; no hover, o cinza de painel (surface-2). Para botões sobre bg-surface/bg-bg.
// - subtle: sem fundo; no hover, o fill translúcido, que clareia qualquer superfície (barras de
//   ferramentas, cabeçalhos surface-2 dos blocos).
// - floating: "chip" com borda e sombra, flutuando sobre o canvas ou uma imagem.
// `danger` troca a cor para o vermelho: com primary, o vermelho cheio da confirmação de apagar;
// nas outras, texto vermelho. `pressed` é o estado ligado de um botão de alternar.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'floating'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'
export type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg'

export type ToneOptions = { danger?: boolean; pressed?: boolean }

// Desligado, o botão não reage ao hover (o fundo e a cor ficam os de repouso).
const TONES: Record<ButtonVariant, { normal: string; danger: string; pressed: string }> = {
  primary: {
    normal: 'bg-accent font-medium text-white hover:brightness-110 disabled:hover:brightness-100',
    danger: 'bg-red-500 font-medium text-white hover:bg-red-600 disabled:hover:bg-red-500',
    pressed: 'bg-accent font-medium text-white hover:brightness-110 disabled:hover:brightness-100'
  },
  secondary: {
    normal: 'border border-line bg-fill text-text hover:bg-surface-2 disabled:hover:bg-fill',
    danger: 'border border-line bg-fill text-red-400 hover:bg-red-500/10 disabled:hover:bg-fill',
    pressed: 'border border-line bg-surface-2 text-text'
  },
  ghost: {
    normal: 'text-muted hover:bg-surface-2 hover:text-text disabled:hover:bg-transparent disabled:hover:text-muted',
    danger: 'text-red-400 hover:bg-red-500/10 disabled:hover:bg-transparent',
    pressed: 'bg-surface-2 text-text'
  },
  // Ligado na cor de destaque, como o "Visualizar" da barra do protótipo.
  subtle: {
    normal: 'text-muted hover:bg-fill hover:text-text disabled:hover:bg-transparent disabled:hover:text-muted',
    danger: 'text-red-400 hover:bg-red-500/10 disabled:hover:bg-transparent',
    pressed: 'bg-accent/15 text-accent'
  },
  floating: {
    normal:
      'border border-line bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-text disabled:hover:bg-surface disabled:hover:text-muted',
    danger: 'border border-line bg-surface text-red-400 shadow-sm hover:bg-red-500/10 disabled:hover:bg-surface',
    pressed: 'border border-accent bg-surface text-accent shadow-sm hover:bg-surface-2 hover:text-text'
  }
}

// Texto: o md é o BUTTON das configurações; o xl, o dos rodapés das boas-vindas.
const SIZES: Record<ButtonSize, string> = {
  sm: 'gap-1.5 px-2.5 py-1 text-xs',
  md: 'gap-1.5 px-3 py-1 text-xs',
  lg: 'gap-1.5 px-3 py-1.5 text-xs',
  xl: 'gap-1.5 px-3.5 py-1.5 text-sm'
}

// Ícone: quadrado. O md (28 px) é o dos cabeçalhos e do X dos modais.
const ICON_SIZES: Record<IconButtonSize, string> = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-7',
  lg: 'size-8'
}

const BASE = 'inline-flex shrink-0 items-center justify-center rounded-md disabled:opacity-40'

// Só as cores (fundo, texto, borda, sombra), para elemento com tamanho próprio, como um link com
// cara de botão ou o botão de servidor que cresce com a porta.
export function buttonTone(variant: ButtonVariant, { danger, pressed }: ToneOptions = {}): string {
  const tone = TONES[variant]
  return danger ? tone.danger : pressed ? tone.pressed : tone.normal
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', options?: ToneOptions): string {
  return `${BASE} whitespace-nowrap ${SIZES[size]} ${buttonTone(variant, options)}`
}

export function iconButtonClass(variant: ButtonVariant = 'ghost', size: IconButtonSize = 'md', options?: ToneOptions): string {
  return `${BASE} ${ICON_SIZES[size]} ${buttonTone(variant, options)}`
}
