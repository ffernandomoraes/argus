// Gestos de toque da imagem com zoom: pinça, arrastar com ela aumentada e dois toques. Pelos eventos
// de toque, não de ponteiro: só neles dá para impedir o navegador de aumentar a página inteira
// (iOS ignora o maximum-scale) sem tirar a rolagem de lado da lista de imagens quando não há zoom.
export type ZoomActions = {
  zoomAt: (x: number, y: number, factor: number) => void
  panBy: (dx: number, dy: number) => void
  toggleAt: (x: number, y: number) => void
  isZoomed: () => boolean
};

type Point = { x: number; y: number };
type Tap = Point & { time: number };
type Touches = Point & { distance: number };

// Até quanto o dedo anda e por quanto tempo ainda conta como toque, e a distância entre dois toques.
const TAP_MOVE = 10;
const TAP_TIME = 300;
const DOUBLE_TAP_DISTANCE = 30;

// Ponto do meio dos dedos e a distância entre os dois primeiros.
function summarize(list: TouchList): Touches {
  const a = list[0];
  const b = list[1] ?? a;
  if (!a || !b) return { x: 0, y: 0, distance: 0 };
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
    distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
  };
}

const near = (a: Point, b: Point, max: number) => Math.hypot(a.x - b.x, a.y - b.y) <= max;

export function attachTouchGestures(el: HTMLElement, actions: ZoomActions): () => void {
  let last: Touches | null = null;
  // Um dedo que ainda pode ser um toque (não andou nem demorou).
  let tap: (Tap & { moved: boolean }) | null = null;
  let previousTap: Tap | null = null;

  const start = (e: TouchEvent) => {
    last = summarize(e.touches);
    tap = e.touches.length === 1 ? { x: last.x, y: last.y, time: e.timeStamp, moved: false } : null;
    if (e.touches.length > 1) e.preventDefault();
  };

  const move = (e: TouchEvent) => {
    if (!last) return;
    const now = summarize(e.touches);
    if (tap && !near(now, tap, TAP_MOVE)) tap.moved = true;
    if (e.touches.length > 1) {
      e.preventDefault();
      if (last.distance > 0) actions.zoomAt(now.x, now.y, now.distance / last.distance);
      actions.panBy(now.x - last.x, now.y - last.y);
    } else if (actions.isZoomed()) {
      // Aumentada, um dedo arrasta a imagem em vez de passar para a próxima.
      e.preventDefault();
      actions.panBy(now.x - last.x, now.y - last.y);
    }
    last = now;
  };

  const end = (e: TouchEvent) => {
    last = e.touches.length ? summarize(e.touches) : null;
    if (e.touches.length) return;
    const ended = tap;
    tap = null;
    if (!ended || ended.moved || e.timeStamp - ended.time > TAP_TIME) return;
    const current: Tap = { x: ended.x, y: ended.y, time: e.timeStamp };
    if (previousTap && current.time - previousTap.time < TAP_TIME && near(current, previousTap, DOUBLE_TAP_DISTANCE)) {
      // Sem o clique e o duplo clique que o navegador simularia depois do toque.
      e.preventDefault();
      previousTap = null;
      actions.toggleAt(current.x, current.y);
    } else previousTap = current;
  };

  const cancel = () => {
    last = null;
    tap = null;
  };
  // Safari: a pinça que aumenta a página inteira.
  const blockGesture = (e: Event) => e.preventDefault();

  const options = { passive: false };
  el.addEventListener('touchstart', start, options);
  el.addEventListener('touchmove', move, options);
  el.addEventListener('touchend', end, options);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('gesturestart', blockGesture, options);
  return () => {
    el.removeEventListener('touchstart', start);
    el.removeEventListener('touchmove', move);
    el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', cancel);
    el.removeEventListener('gesturestart', blockGesture);
  };
}
