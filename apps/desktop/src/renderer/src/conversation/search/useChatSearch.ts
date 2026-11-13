import { useCallback, useDeferredValue, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { TimelineHandle } from '../timeline/Timeline';
import type { TimelineItem } from '../timeline/timelineItem';
import type { OlderMessages } from '../timeline/useOlderMessages';
import { useEscape } from '../../useEscape';
import { clearHighlights, rangesIn, setHighlights } from './highlights';
import { fold, foldQuery } from './textSearch';

// Um resultado: a linha da conversa (chave e posição na lista) e qual ocorrência dentro dela.
type Hit = { key: string; index: number; nth: number };
type Spot = { key: string; nth: number };

// Quadros esperando a linha montar depois de a lista virtualizada rolar até ela.
const MOUNT_TRIES = 30;
// Folga das bordas da área: resultado mais perto que isso dela é trazido para o meio.
const EDGE = 48;
// Textos já simplificados (fold), para não refazer a conversa inteira a cada letra digitada.
const CACHE_MAX = 4000;

type Options = {
  rows: TimelineItem[]
  scroller: RefObject<HTMLDivElement | null>
  timeline: RefObject<TimelineHandle | null>
  older?: OlderMessages
  // Sobe para abrir a busca (⌘F, a lupa do cabeçalho); 0 = nunca pedida.
  openSignal: number
  // Pulou para um resultado: a conversa para de seguir o fim (useStickyScroll).
  onJump: () => void
};

// Busca dentro da conversa, como o ⌘F do navegador, mas sobre os dados: a lista é virtualizada e
// só as linhas perto da tela existem no HTML. Conta os resultados no texto das mensagens (o
// `search` de cada linha), rola a lista até o escolhido e destaca o termo nas linhas montadas.
// Aberta, carrega o começo da conversa que ainda não veio do disco, para procurar em tudo.
export function useChatSearch({ rows, scroller, timeline, older, openSignal, onJump }: Options) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [spot, setSpot] = useState<Spot | null>(null);
  // Sobe a cada pedido de abrir: a caixa já aberta volta a ganhar o foco com o texto selecionado.
  const [focusSignal, setFocusSignal] = useState(0);
  // Onde estava o foco ao abrir: volta para lá ao fechar (a caixa de escrever, quase sempre).
  const before = useRef<HTMLElement | null>(null);
  // Sobe a cada pedido de ir até o resultado escolhido (termo novo, setas, Enter). Contador, e não
  // o próprio resultado: Enter com um resultado só volta até ele.
  const [jumpTick, setJumpTick] = useState(0);
  const goTo = useCallback((hit: Hit) => {
    setSpot({ key: hit.key, nth: hit.nth });
    setJumpTick((n) => n + 1);
  }, []);

  // Digitando rápido numa conversa enorme, a contagem fica para depois da letra aparecer.
  const deferred = useDeferredValue(query);
  const needle = open ? foldQuery(deferred) : '';

  const cache = useRef(new Map<string, string>());
  const hits = useMemo<Hit[]>(() => {
    if (!needle) return [];
    const folded = cache.current;
    if (folded.size > CACHE_MAX) folded.clear();
    const found: Hit[] = [];
    rows.forEach((row, index) => {
      const text = 'search' in row ? row.search : undefined;
      if (!text) return;
      let hay = folded.get(text);
      if (hay === undefined) folded.set(text, (hay = fold(text).text));
      let nth = 0;
      for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) found.push({ key: row.key, index, nth: nth++ });
    });
    return found;
  }, [rows, needle]);

  const current = spot ? hits.findIndex((h) => h.key === spot.key && h.nth === spot.nth) : -1;

  // Procura em tudo: enquanto há anteriores, pede todas (de novo, se um lote comum estava no meio).
  const more = !!older?.more;
  const loadingOlder = !!older?.loading;
  const loadAll = older?.loadAll;
  useEffect(() => {
    if (needle && more && !loadingOlder) loadAll?.();
  }, [needle, more, loadingOlder, loadAll]);

  // Termo novo: o primeiro resultado a partir do que está na tela (como no navegador); sem nenhum
  // abaixo, o último. Leva até ele assim que houver um: o termo que só existe no começo da
  // conversa espera ela chegar do disco. O resultado escolhido que sumiu (a conversa mudou)
  // também escolhe de novo, mas sem rolar.
  const visibleIndex = useCallback(() => {
    const root = scroller.current;
    if (!root) return 0;
    const top = root.getBoundingClientRect().top;
    for (const el of root.querySelectorAll<HTMLElement>('[data-index]')) {
      if (el.getBoundingClientRect().bottom > top) return Number(el.dataset.index);
    }
    return 0;
  }, [scroller]);
  // O termo cujo primeiro resultado já foi mostrado.
  const shownFor = useRef('');
  useLayoutEffect(() => {
    if (!hits.length) {
      if (spot) setSpot(null);
      return;
    }
    const fresh = shownFor.current !== needle;
    if (!fresh && current >= 0) return;
    const from = visibleIndex();
    const hit = hits.find((h) => h.index >= from) ?? hits[hits.length - 1];
    if (!fresh) return setSpot({ key: hit.key, nth: hit.nth });
    shownFor.current = needle;
    goTo(hit);
  }, [needle, hits, current, spot, visibleIndex, goTo]);

  // Destaca o termo nas linhas montadas, com o escolhido em outra cor. Refaz quando a lista monta
  // outras linhas (rolagem) ou o texto muda; um quadro de cada vez.
  const owner = useRef({});
  const paint = useCallback(() => {
    const root = scroller.current;
    if (!root || !needle) return clearHighlights(owner.current);
    const hit = current >= 0 ? hits[current] : null;
    const all: Range[] = [];
    let chosen: Range | null = null;
    for (const el of root.querySelectorAll<HTMLElement>('[data-index]')) {
      const ranges = rangesIn(el, deferred);
      all.push(...ranges);
      if (hit && Number(el.dataset.index) === hit.index && ranges.length) chosen = ranges[Math.min(hit.nth, ranges.length - 1)];
    }
    setHighlights(owner.current, all, chosen);
  }, [scroller, needle, deferred, hits, current]);

  useEffect(() => {
    const root = scroller.current;
    if (!root || !needle) {
      clearHighlights(owner.current);
      return;
    }
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scroller, needle, paint]);

  useEffect(() => {
    const id = owner.current;
    return () => clearHighlights(id);
  }, []);

  // Vai até o resultado escolhido: a lista rola até a linha (montando-a, se estava longe) e o
  // trecho achado fica no meio da área, se estiver perto da borda ou fora dela. A espera pela linha
  // não para quando a conversa muda no meio (o Claude respondendo refaz a lista a cada trecho):
  // só um pedido novo cancela o anterior.
  const handled = useRef(0);
  const frame = useRef(0);
  useEffect(() => {
    if (jumpTick === handled.current || current < 0) return;
    handled.current = jumpTick;
    const hit = hits[current];
    const root = scroller.current;
    if (!root) return;
    onJump();
    cancelAnimationFrame(frame.current);
    const reveal = (tries: number) => {
      const el = root.querySelector<HTMLElement>(`[data-index="${hit.index}"]`);
      if (!el) {
        if (tries === 0) timeline.current?.scrollToKey(hit.key);
        if (tries < MOUNT_TRIES) frame.current = requestAnimationFrame(() => reveal(tries + 1));
        return;
      }
      const ranges = rangesIn(el, deferred);
      const target = ranges[Math.min(hit.nth, ranges.length - 1)] ?? el;
      const box = root.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      if (rect.top >= box.top + EDGE && rect.bottom <= box.bottom - EDGE) return;
      // Com o zoom do drawer, a medida na tela e a rolagem estão em escalas diferentes.
      const scale = root.offsetHeight ? box.height / root.offsetHeight : 1;
      const offset = rect.top - box.top - (box.height - Math.min(rect.height, box.height)) / 2;
      root.scrollTop += offset / (scale || 1);
    };
    reveal(0);
  }, [jumpTick, current, hits, scroller, timeline, deferred, onJump]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!hits.length) return;
      const from = current < 0 ? (direction > 0 ? -1 : 0) : current;
      goTo(hits[(from + direction + hits.length) % hits.length]);
    },
    [hits, current, goTo],
  );

  // Abrir: com um trecho selecionado na conversa (uma linha só), ele vira o termo, como no Mac.
  const openNow = useEffectEvent(() => {
    const active = document.activeElement;
    if (!open) before.current = active instanceof HTMLElement ? active : null;
    const selection = window.getSelection();
    const picked = selection && !selection.isCollapsed && scroller.current?.contains(selection.anchorNode) ? selection.toString().trim() : '';
    if (picked && !picked.includes('\n')) setQuery(picked);
    setOpen(true);
    setFocusSignal((n) => n + 1);
  });
  useEffect(() => {
    if (openSignal) openNow();
  }, [openSignal]);

  const close = useCallback(() => {
    setOpen(false);
    setSpot(null);
    shownFor.current = '';
    clearHighlights(owner.current);
    const back = before.current;
    before.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
  }, []);
  // Empilhado depois do fechar do drawer: o ESC fecha a busca primeiro.
  useEscape(close, open);

  // Procurando no começo da conversa, que ainda está vindo do disco.
  const searching = !!needle && more;

  return { open, query, setQuery, total: hits.length, current, searching, step, close, focusSignal };
}

export type ChatSearch = ReturnType<typeof useChatSearch>;
