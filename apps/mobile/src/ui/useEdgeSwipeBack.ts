import { useEffect, useRef } from 'react';
import { ownHistory } from '../lib/router';

// No app instalado do iPhone, arrastar da borda esquerda para a direita é o mesmo que tocar no botão
// de voltar do topo: chama a mesma função, com o mesmo fade. O voltar do Safari não tem o que voltar
// ali (ver ownHistory em lib/router.ts). No navegador e no Android, fica o gesto do sistema.

// Começo do arraste: perto da borda, como o do iOS.
const EDGE_PX = 24;
// Arraste mínimo para a direita para valer, e mais na horizontal que na vertical (rolar não volta).
const MIN_DISTANCE_PX = 60;

// Gaveta, imagem aberta ou camada de "sem ligação" na frente: o botão de voltar fica coberto, o
// arraste também não volta.
const covered = () => document.querySelector('[aria-modal="true"], [role="alertdialog"]') !== null;

export function useEdgeSwipeBack(onBack: () => void): void {
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!ownHistory) return;
    let start: { x: number; y: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t.clientX <= EDGE_PX && !covered() ? { x: t.clientX, y: t.clientY } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      start = null;
      if (dx >= MIN_DISTANCE_PX && dy < dx / 2) latest.current();
    };
    const onCancel = () => {
      start = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, []);
}
