import { powerSaveBlocker } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { RemoteClient } from './client';
import { memoryLinks } from './link';

// No notebook, com as janelas do Argus de lá fora de vista (outra mesa do macOS), o App Nap
// atrasava a conferência da ponte e a ligação caía; ao religar, a janela recarregava e os drawers
// fixados sumiam (2026-11-16). Enquanto a ligação existe, o app não entra em economia.

describe.runIf(process.platform === 'darwin')('ligação remota segura a economia do app (Mac)', () => {
  it('segura ao abrir e solta ao encerrar', () => {
    const live = new Set<number>();
    let next = 0;
    Object.assign(powerSaveBlocker, {
      start: vi.fn((type: string) => {
        expect(type).toBe('prevent-app-suspension');
        live.add(++next);
        return next;
      }),
      stop: vi.fn((id: number) => live.delete(id)),
      isStarted: (id: number) => live.has(id),
    });
    const [, clientSide] = memoryLinks();
    const client = new RemoteClient(clientSide, '1.0.0', 'notebook');
    expect(live.size).toBe(1);
    client.close();
    expect(live.size).toBe(0);
    client.close();
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
  });
});
