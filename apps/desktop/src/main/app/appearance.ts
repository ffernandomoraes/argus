import { nativeTheme } from 'electron';
import type { ThemeSource } from '@argus/shared/ipc';
import { repaintOverlays } from './windowChrome';

// Tema (claro, escuro ou o do sistema). A cor de destaque é fixa, o laranja do Argus (ver
// renderer/src/styles/tokens.css): não segue mais a do sistema.

export function setTheme(theme: ThemeSource): void {
  nativeTheme.themeSource = theme;
  repaintOverlays();
}

// Tema trocado no sistema: os botões do Windows acompanham.
export function watchAppearance(): void {
  nativeTheme.on('updated', repaintOverlays);
}
