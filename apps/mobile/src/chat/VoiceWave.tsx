import { useEffect, useRef, useState } from 'react';

const BARS = 10;
// Altura das barras em silêncio (um respiro leve) e a cada palavra nova captada.
const IDLE = 0.12;
const IDLE_JITTER = 0.1;
const PEAK = 0.65;
const PEAK_JITTER = 0.35;

// Ondinhas do ditado, como no Argus. O reconhecimento de voz do navegador não dá o volume (só o
// texto, e abrir o microfone de novo pediria outra permissão no iPhone): elas sobem a cada mudança
// em signal (o texto ditado) e baixam no silêncio. Deslizam da direita para a esquerda; cada barra
// é um instante recente.
export function VoiceWave({ signal }: { signal: string }) {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(IDLE));
  const latest = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current = PEAK + Math.random() * PEAK_JITTER;
  }, [signal]);

  useEffect(() => {
    const id = setInterval(() => {
      const idle = IDLE + Math.random() * IDLE_JITTER;
      setLevels((l) => [...l.slice(1), Math.max(idle, latest.current)]);
      latest.current *= 0.6;
    }, 60);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="flex h-5 shrink-0 items-center gap-[2px]" aria-hidden="true">
      {levels.map((v, i) => (
        <span key={i} className="w-[2px] rounded-full bg-running transition-[height] duration-75" style={{ height: `${Math.min(100, v * 100)}%` }} />
      ))}
    </span>
  );
}
