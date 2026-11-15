import { useEffect, useRef } from 'react';

// Tocar e segurar: depois de LONG_PRESS_MS sem arrastar, chama onLongPress e o toque não vira
// clique. Arrastar (rolar a lista de lado) cancela. O menu do próprio iPhone (copiar, compartilhar)
// fica de fora pelo onContextMenu, pela classe NO_CALLOUT e por barrar o selectstart enquanto o dedo
// está na tela: só o user-select:none no botão não basta, o Safari do iPhone ainda começava a
// selecionar o texto e cancelava o toque antes do tempo.

const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE_PX = 10;

export const NO_CALLOUT = 'select-none [-webkit-touch-callout:none]';

const blockSelection = (e: Event) => e.preventDefault();

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);
  const stopBlocking = () => document.removeEventListener('selectstart', blockSelection);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stopBlocking();
  };
  // Saiu da tela com o dedo ainda nela: solta o selectstart e o tempo.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    document.removeEventListener('selectstart', blockSelection);
  }, []);
  const fire = () => {
    fired.current = true;
    cancel();
    window.getSelection()?.removeAllRanges();
    onLongPress();
  };
  return {
    onTouchStart: (e: React.TouchEvent) => {
      fired.current = false;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      cancel();
      document.addEventListener('selectstart', blockSelection);
      timer.current = setTimeout(fire, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - start.current.x) > MOVE_TOLERANCE_PX || Math.abs(t.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    // Clique direito no computador (e o toque longo do Android, que chega como contextmenu).
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (fired.current) return;
      fire();
    },
    // Depois do toque longo, o clique que o navegador ainda manda não troca de workspace.
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
