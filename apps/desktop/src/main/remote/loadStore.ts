import { loadRemoteStore, StoreUnavailable, type RemoteStore } from './store';

// Pareamentos que não deu para ler agora (ver StoreUnavailable): nova tentativa nesse intervalo.
const RELOAD_MS = 15_000;

// Os pareamentos guardados, ou nulo quando não dá para ler agora: aí tenta de novo sozinho, até
// conseguir, e entrega em `later`. Arquivo estragado de vez não chega aqui (loadRemoteStore o põe de
// lado e começa do zero).
export function loadStoreWhenReady(later: (store: RemoteStore) => void): RemoteStore | null {
  try {
    return loadRemoteStore();
  } catch (err) {
    if (!(err instanceof StoreUnavailable)) throw err;
    console.error('[remoto] pareamentos sem leitura agora, tentando de novo:', err.message);
    setTimeout(() => {
      const store = loadStoreWhenReady(later);
      if (store) later(store);
    }, RELOAD_MS);
    return null;
  }
}
