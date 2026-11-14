import { useEffect, useRef, useState } from 'react';

// Até onde ainda conta como "no fim" da conversa.
const NEAR_END_PX = 80;
// Depois de arrastar o dedo (ou girar a roda do mouse), quanto tempo a rolagem conta como sua: o
// iPhone segue rolando sozinho depois de soltar.
const USER_SCROLL_MS = 1200;

const distanceToEnd = () => document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);

export const scrollToEnd = () => window.scrollTo(0, document.documentElement.scrollHeight);

// A conversa acompanha o fim enquanto você está nele. Subir com o dedo solta na hora; voltar ao fim
// prende de novo. Antes, só soltava a mais de 160px do fim, e cada pedaço novo da resposta puxava de
// volta para baixo: com o agente escrevendo, a rolagem parecia travada. A página mudar de altura
// sem você rolar (a resposta trocada pela gravada) não solta.
export function useStickToBottom() {
  const stick = useRef(true);
  useEffect(() => {
    let lastY = window.scrollY;
    // Último arraste do dedo ou giro da roda. Toque sem arrastar (num botão) não conta.
    let movedAt = 0;
    const moved = () => {
      movedAt = Date.now();
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY && Date.now() - movedAt < USER_SCROLL_MS) stick.current = false;
      else if (distanceToEnd() <= NEAR_END_PX) stick.current = true;
      lastY = y;
    };
    const opts = { passive: true };
    window.addEventListener('touchmove', moved, opts);
    window.addEventListener('wheel', moved, opts);
    window.addEventListener('scroll', onScroll, opts);
    return () => {
      window.removeEventListener('touchmove', moved);
      window.removeEventListener('wheel', moved);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return stick;
}

// A partir de quanto longe do fim aparece o botão de descer.
const AWAY_FROM_END_PX = 400;

// Longe do fim da conversa (você subiu para ler): mostra o botão de descer. Só redesenha quando
// cruza a distância, não a cada movimento.
export function useAwayFromEnd(): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const check = () => setAway(distanceToEnd() > AWAY_FROM_END_PX);
    check();
    const opts = { passive: true };
    window.addEventListener('scroll', check, opts);
    window.addEventListener('resize', check, opts);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  return away;
}
