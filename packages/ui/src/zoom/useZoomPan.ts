import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';
import { attachTouchGestures, type ZoomActions } from './touchGestures';
import { DOUBLE_TAP_SCALE, NO_ZOOM, baseBox, clampZoom, zoomAround, type Box, type Zoom } from './zoomMath';

// Quanto um passo da roda (com Ctrl, ou a pinça do trackpad, que chega assim) muda o zoom.
const WHEEL_SPEED = 0.01;
const WHEEL_STEP = 60;
const LINE_HEIGHT = 16;

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

// Zoom de uma imagem aberta em tela cheia: pinça (no toque e no trackpad), dois cliques ou dois
// toques para aumentar e voltar, e arrastar quando está aumentada. Tudo em `bind`, a ser espalhado no
// <img>; a imagem volta ao tamanho normal quando o componente que a mostra é montado de novo.
export function useZoomPan<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const zoomRef = useRef<Zoom>(NO_ZOOM);
  const [view, setView] = useState({ zoom: NO_ZOOM, animated: false });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const actions = useMemo<ZoomActions>(() => {
    const apply = (next: (zoom: Zoom, box: Box) => Zoom, animated = false) => {
      const el = ref.current;
      if (!el) return;
      const box = baseBox(el, zoomRef.current);
      const zoom = clampZoom(next(zoomRef.current, box), box, viewport());
      zoomRef.current = zoom;
      setView({ zoom, animated });
    };
    return {
      zoomAt: (x, y, factor) => apply((zoom, box) => zoomAround(zoom, box, { x, y }, factor)),
      panBy: (dx, dy) => apply((zoom) => ({ ...zoom, x: zoom.x + dx, y: zoom.y + dy })),
      toggleAt: (x, y) =>
        apply((zoom, box) => (zoom.scale > 1 ? NO_ZOOM : zoomAround(zoom, box, { x, y }, DOUBLE_TAP_SCALE)), true),
      isZoomed: () => zoomRef.current.scale > 1,
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      const delta = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT : e.deltaY;
      if (e.ctrlKey) {
        const step = Math.max(-WHEEL_STEP, Math.min(WHEEL_STEP, delta));
        actions.zoomAt(e.clientX, e.clientY, Math.exp(-step * WHEEL_SPEED));
      } else if (actions.isZoomed()) actions.panBy(-e.deltaX, -delta);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    const detachTouch = attachTouchGestures(el, actions);
    return () => {
      el.removeEventListener('wheel', wheel);
      detachTouch();
    };
  }, [actions]);

  const { zoom, animated } = view;
  const zoomed = zoom.scale > 1;

  // Mouse (o toque vai por attachTouchGestures): arrastar só com a imagem aumentada.
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const bind = {
    ref,
    draggable: !zoomed,
    onPointerDown: (e: PointerEvent<T>) => {
      if (e.pointerType === 'touch' || e.button !== 0 || !actions.isZoomed()) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY };
      setDragging(true);
    },
    onPointerMove: (e: PointerEvent<T>) => {
      const from = drag.current;
      if (!from) return;
      drag.current = { x: e.clientX, y: e.clientY };
      actions.panBy(e.clientX - from.x, e.clientY - from.y);
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onDoubleClick: (e: MouseEvent<T>) => actions.toggleAt(e.clientX, e.clientY),
    style: {
      transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
      transformOrigin: '0 0',
      transition: animated ? 'transform 200ms ease' : undefined,
      cursor: zoomed ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
      touchAction: zoomed ? 'none' : 'pan-x',
    } satisfies CSSProperties,
  };
  return { bind, zoomed };
}
