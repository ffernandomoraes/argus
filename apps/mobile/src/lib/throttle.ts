// No máximo uma chamada a cada `ms`: os pedidos que chegam no meio viram uma chamada só, no fim do
// intervalo. O Argus avisa uma mudança a cada gravação da conversa (várias por segundo enquanto o
// agente trabalha); reler tudo a cada aviso travava o celular.
export function throttle(fn: () => void, ms: number): { run: () => void; cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => {
    timer = null;
    last = Date.now();
    fn();
  };
  return {
    run: () => {
      if (timer) return;
      const wait = last + ms - Date.now();
      if (wait <= 0) fire();
      else timer = setTimeout(fire, wait);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
