import { useEffect, useState } from 'react';

// Hora atual, renovada a cada `ms` enquanto o componente estiver na tela (os contadores de tempo).
export function useNow(ms: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
