// Textos do app do celular em português ou inglês, pelo idioma do navegador (como o Argus).
const pt = typeof navigator === 'undefined' || navigator.language.toLowerCase().startsWith('pt');

export const LOCALE = pt ? 'pt-BR' : 'en-US';

export function tr(ptText: string, enText: string): string {
  return pt ? ptText : enText;
}
