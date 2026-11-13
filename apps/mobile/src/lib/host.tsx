import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { HostConnection } from '../net/connection';
import { cacheGet, cacheSet } from './cache';

// A conexão com o Argus de casa para as telas: o status e a "época" (sobe a cada ligação nova; o que
// é por página lá, como conversas seguradas e pastas vigiadas, precisa ser pedido de novo).

type HostValue = { conn: HostConnection; epoch: number };

const HostContext = createContext<HostValue | null>(null);

export function HostProvider({ conn, children }: { conn: HostConnection; children: ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    let wasOnline = conn.status === 'online';
    return conn.onStatus(() => {
      const online = conn.status === 'online';
      if (online && !wasOnline) setEpoch((e) => e + 1);
      wasOnline = online;
    });
  }, [conn]);
  return <HostContext.Provider value={{ conn, epoch }}>{children}</HostContext.Provider>;
}

export function useHost(): HostValue {
  const v = useContext(HostContext);
  if (!v) throw new Error('sem HostProvider');
  return v;
}

export function useStatus(): HostConnection['status'] {
  const { conn } = useHost();
  return useSyncExternalStore(
    (cb) => conn.onStatus(cb),
    () => conn.status,
  );
}

// Última resposta de cada pedido com chave (ver lib/cache.ts): a tela que volta, ou o app que
// abre, aparece na hora com o que já tinha e atualiza por baixo, em vez de começar vazia.

// Um pedido ao Argus de casa, refeito a cada ligação nova e quando `reload` é chamado. Mantém o
// último valor enquanto recarrega (a tela não pisca). `cacheKey`: guarda a resposta (ver cache).
export function useRemote<T>(
  load: (conn: HostConnection) => Promise<T>,
  deps: unknown[],
  cacheKey?: string,
): { data: T | undefined; error: string | null; reload: () => void } {
  const { conn, epoch } = useHost();
  const [data, setData] = useState<T | undefined>(() => (cacheKey ? cacheGet<T>(cacheKey) : undefined));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  // Trocou de chave (outra pasta): começa pelo guardado dela.
  const shownKey = useRef(cacheKey);
  if (shownKey.current !== cacheKey) {
    shownKey.current = cacheKey;
    setData(cacheKey ? cacheGet<T>(cacheKey) : undefined);
  }
  useEffect(() => {
    if (conn.status !== 'online') return;
    let alive = true;
    loadRef.current(conn).then(
      (v) => {
        if (!alive) return;
        if (cacheKey) cacheSet(cacheKey, v);
        setData(v);
        setError(null);
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [conn, epoch, tick, cacheKey, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

// Pastas vigiadas: o Argus de casa guarda uma lista por página, então a lista inteira vai a cada
// mudança (e de novo a cada ligação nova).
const watched = new Map<string, number>();
let flush: (() => void) | null = null;

export function useWatchFolder(path: string | null): void {
  const { conn, epoch } = useHost();
  flush = () => void conn.call('sessions:watch', [...watched.keys()]).catch(() => {});
  useEffect(() => {
    if (!path) return;
    watched.set(path, (watched.get(path) ?? 0) + 1);
    flush?.();
    return () => {
      const n = (watched.get(path) ?? 1) - 1;
      if (n <= 0) watched.delete(path);
      else watched.set(path, n);
      flush?.();
    };
  }, [path]);
  useEffect(() => {
    if (epoch && watched.size) flush?.();
  }, [epoch]);
}
